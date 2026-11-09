"""Carga datos de demostración en Cognito y DynamoDB.

Este proceso se ejecuta desde una computadora o desde CI después del deploy.
No contiene nombres físicos de recursos ni credenciales: los nombres se leen de
los outputs de CloudFormation y boto3 usa la cadena estándar de credenciales AWS.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CATALOG_FILE = Path(__file__).resolve().parent / "data" / "course-catalog.json"
ID_NAMESPACE = uuid.UUID("9c3f37d4-908d-44c9-8be4-642743df164b")
SCHEDULE_TEMPLATES = (
    ("MON", "WED", "18:00", "20:00"),
    ("TUE", "THU", "09:00", "11:00"),
    ("SAT", "SAT", "08:00", "12:00"),
)


@dataclass(frozen=True)
class Settings:
    stage: str
    region: str
    tenants: tuple[str, ...]
    students: int
    instructors: int
    courses_per_instructor: int
    random_state: int
    start_date: date


def load_environment_file(env_file: Path, override: bool = False) -> None:
    """Carga un archivo dotenv sencillo sin sobrescribir variables exportadas."""
    if env_file.exists():
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and (override or key not in os.environ):
                os.environ[key] = value


def load_local_environment() -> None:
    """Carga variables privadas para operar contra una cuenta AWS real."""
    load_environment_file(ROOT / ".env.local")


def stable_id(*parts: object) -> str:
    return str(uuid.uuid5(ID_NAMESPACE, "/".join(str(part) for part in parts)))


def validate_ingestion_target(stage: str, dry_run: bool, allow_staging: bool) -> None:
    """Impide cargar o sobrescribir identidades de prueba en entornos sensibles."""
    if dry_run:
        return
    if stage == "production":
        raise RuntimeError("La ingesta de demostración está deshabilitada en production")
    if stage == "staging" and not allow_staging:
        raise RuntimeError(
            "La ingesta en staging requiere --allow-staging para confirmar el destino"
        )


def read_stack_output(outputs: dict[str, dict[str, str]], suffix: str, key: str) -> str:
    for stack_name, values in outputs.items():
        if stack_name.endswith(suffix) and values.get(key):
            return values[key]
    raise RuntimeError(f"No se encontró el output {suffix}.{key}")


def load_outputs(stage: str) -> tuple[str, dict[str, str]]:
    output_file = ROOT / "outputs" / f"{stage}.json"
    if not output_file.exists():
        raise RuntimeError(
            f"No existe {output_file}. Ejecuta primero npm run deploy:{stage}."
        )
    outputs = json.loads(output_file.read_text(encoding="utf-8"))
    user_pool_id = read_stack_output(outputs, "-Auth", "UserPoolId")
    return user_pool_id, {
        "organizations": read_stack_output(
            outputs, "-Organizations", "OrganizationsTableName"
        ),
        "profiles": read_stack_output(outputs, "-Users", "ProfilesTableName"),
        "courses": read_stack_output(outputs, "-Courses", "CoursesTableName"),
        "schedules": read_stack_output(
            outputs, "-Schedules", "SchedulesTableName"
        ),
        "purchases": read_stack_output(
            outputs, "-Purchases", "PurchasesTableName"
        ),
    }


def load_catalog() -> list[dict[str, Any]]:
    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    if not isinstance(catalog, list) or not catalog:
        raise RuntimeError(f"El catálogo {CATALOG_FILE} debe ser una lista no vacía")
    return catalog


def user_specs(settings: Settings) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for tenant in settings.tenants:
        result.append(
            {
                "tenantId": tenant,
                "email": f"admin@{tenant}.demo",
                "fullName": f"Administrador {tenant.title()}",
                "role": "admin",
            }
        )
        for index in range(1, settings.instructors + 1):
            result.append(
                {
                    "tenantId": tenant,
                    "email": f"instructor{index}@{tenant}.demo",
                    "fullName": f"Instructor {index} de {tenant.title()}",
                    "role": "instructor",
                }
            )
        for index in range(1, settings.students + 1):
            result.append(
                {
                    "tenantId": tenant,
                    "email": f"student{index}@{tenant}.demo",
                    "fullName": f"Estudiante {index} de {tenant.title()}",
                    "role": "student",
                }
            )
    return result


def build_plan(settings: Settings, user_ids: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    catalog = load_catalog()
    rng = random.Random(settings.random_state)
    plan: dict[str, list[dict[str, Any]]] = {
        "organizations": [],
        "profiles": [],
        "courses": [],
        "schedules": [],
        "purchases": [],
    }

    for spec in user_specs(settings):
        plan["profiles"].append(
            {
                "tenantId": spec["tenantId"],
                "userId": user_ids[spec["email"]],
                "email": spec["email"],
                "fullName": spec["fullName"],
                "role": spec["role"],
                "createdAt": now,
                "updatedAt": now,
            }
        )

    for tenant_index, tenant in enumerate(settings.tenants):
        plan["organizations"].append(
            {
                "organizationId": tenant,
                "name": f"Academia {tenant.title()}",
                "domain": f"{tenant}.demo",
                "email": f"contacto@{tenant}.demo",
                "description": "Organización generada por la ingesta de demostración",
                "createdAt": now,
                "updatedAt": now,
            }
        )
        instructor_emails = [
            f"instructor{index}@{tenant}.demo"
            for index in range(1, settings.instructors + 1)
        ]
        student_emails = [
            f"student{index}@{tenant}.demo"
            for index in range(1, settings.students + 1)
        ]
        tenant_course_number = 0

        for instructor_number, email in enumerate(instructor_emails, start=1):
            for course_slot in range(1, settings.courses_per_instructor + 1):
                catalog_index = (
                    tenant_index * settings.instructors * settings.courses_per_instructor
                    + tenant_course_number
                ) % len(catalog)
                template = catalog[catalog_index]
                course_id = stable_id(
                    settings.stage, tenant, "course", instructor_number, course_slot
                )
                course_start = settings.start_date + timedelta(days=tenant_course_number * 3)
                course = {
                    "tenantId": tenant,
                    "courseId": course_id,
                    "instructorId": user_ids[email],
                    "name": template["name"],
                    "description": template["description"],
                    "startDate": course_start.isoformat(),
                    "endDate": (course_start + timedelta(days=60)).isoformat(),
                    "price": Decimal(str(template["price"])),
                    "createdAt": now,
                    "updatedAt": now,
                }
                plan["courses"].append(course)

                for schedule_number, schedule_template in enumerate(
                    SCHEDULE_TEMPLATES, start=1
                ):
                    first_day, second_day, start_time, end_time = schedule_template
                    schedule_id = stable_id(course_id, "schedule", schedule_number)
                    schedule = {
                        "tenantCourseId": f"{tenant}#{course_id}",
                        "tenantId": tenant,
                        "courseId": course_id,
                        "scheduleId": schedule_id,
                        "days": list(dict.fromkeys((first_day, second_day))),
                        "startTime": start_time,
                        "endTime": end_time,
                        "capacity": 30,
                        "occupiedCount": 2,
                        "status": "open",
                        "createdAt": now,
                        "updatedAt": now,
                    }
                    plan["schedules"].append(schedule)

                    for buyer_offset in range(2):
                        buyer_index = (
                            tenant_course_number * len(SCHEDULE_TEMPLATES) * 2
                            + (schedule_number - 1) * 2
                            + buyer_offset
                        ) % len(student_emails)
                        buyer_email = student_emails[buyer_index]
                        buyer_id = user_ids[buyer_email]
                        purchase_id = stable_id(
                            tenant, buyer_id, course_id, schedule_id, "purchase"
                        )
                        plan["purchases"].append(
                            {
                                "tenantUserId": f"{tenant}#{buyer_id}",
                                "tenantId": tenant,
                                "userId": buyer_id,
                                "purchaseId": purchase_id,
                                "idempotencyKey": purchase_id,
                                "courseId": course_id,
                                "scheduleId": schedule_id,
                                "status": rng.choice(("reserved", "enrolled")),
                                "amount": course["price"],
                                "createdAt": now,
                                "updatedAt": now,
                            }
                        )
                tenant_course_number += 1
    return plan


def ensure_cognito_user(
    client: Any,
    user_pool_id: str,
    spec: dict[str, str],
    password: str,
) -> str:
    attributes = [
        {"Name": "email", "Value": spec["email"]},
        {"Name": "email_verified", "Value": "true"},
        {"Name": "custom:tenant_id", "Value": spec["tenantId"]},
        {"Name": "custom:role", "Value": spec["role"]},
    ]
    try:
        client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=spec["email"],
            MessageAction="SUPPRESS",
            UserAttributes=attributes,
        )
    except client.exceptions.UsernameExistsException:
        pass
    client.admin_update_user_attributes(
        UserPoolId=user_pool_id,
        Username=spec["email"],
        UserAttributes=attributes,
    )
    client.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=spec["email"],
        Password=password,
        Permanent=True,
    )
    client.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=spec["email"],
        GroupName=spec["role"],
    )
    current_groups = client.admin_list_groups_for_user(
        UserPoolId=user_pool_id,
        Username=spec["email"],
    ).get("Groups", [])
    for group in current_groups:
        group_name = group.get("GroupName")
        if group_name in {"admin", "instructor", "student"} and group_name != spec["role"]:
            client.admin_remove_user_from_group(
                UserPoolId=user_pool_id,
                Username=spec["email"],
                GroupName=group_name,
            )
    response = client.admin_get_user(
        UserPoolId=user_pool_id, Username=spec["email"]
    )
    sub = next(
        (
            attribute["Value"]
            for attribute in response["UserAttributes"]
            if attribute["Name"] == "sub"
        ),
        None,
    )
    if not sub:
        raise RuntimeError(f"Cognito no devolvió sub para {spec['email']}")
    return sub


def write_plan(dynamodb: Any, tables: dict[str, str], plan: dict[str, list[dict[str, Any]]]) -> None:
    keys = {
        "organizations": ["organizationId"],
        "profiles": ["tenantId", "userId"],
        "courses": ["tenantId", "courseId"],
        "schedules": ["tenantCourseId", "scheduleId"],
        "purchases": ["tenantUserId", "purchaseId"],
    }
    for section in ("organizations", "profiles", "courses", "schedules", "purchases"):
        table = dynamodb.Table(tables[section])
        with table.batch_writer(overwrite_by_pkeys=keys[section]) as batch:
            for item in plan[section]:
                batch.put_item(Item=item)
        print(f"  {section}: {len(plan[section])} elementos -> {tables[section]}")


def print_summary(plan: dict[str, list[dict[str, Any]]], dry_run: bool) -> None:
    mode = "SIMULACIÓN; AWS no fue modificado" if dry_run else "INGESTA COMPLETADA"
    print(f"\n{mode}")
    for section, items in plan.items():
        print(f"  {section}: {len(items)}")
    print(
        "\nLos streams de DynamoDB enviarán cursos/horarios a OpenSearch "
        "y archivarán eventos de compras en S3."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera datos multi-tenant de prueba en el entorno AWS desplegado"
    )
    parser.add_argument("--stage", default=os.getenv("STAGE", "dev"))
    parser.add_argument(
        "--tenants", default=os.getenv("INGESTION_TENANTS", "udemy,cursarplus")
    )
    parser.add_argument("--students", type=int, default=6)
    parser.add_argument("--instructors", type=int, default=5)
    parser.add_argument("--courses-per-instructor", type=int, default=5)
    parser.add_argument("--random-state", type=int, default=2026)
    parser.add_argument("--start-date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--allow-staging",
        action="store_true",
        help="Confirma explícitamente la carga de datos de demostración en staging",
    )
    return parser.parse_args()


def main() -> int:
    load_local_environment()
    args = parse_args()
    tenants = tuple(
        dict.fromkeys(value.strip().lower() for value in args.tenants.split(",") if value.strip())
    )
    if not tenants:
        raise RuntimeError("Debes indicar al menos un tenant")
    if any(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?", tenant) is None for tenant in tenants):
        raise RuntimeError("Cada tenant debe usar sólo minúsculas, números y guiones")
    if min(args.students, args.instructors, args.courses_per_instructor) < 1:
        raise RuntimeError("students, instructors y courses-per-instructor deben ser mayores que cero")
    settings = Settings(
        stage=args.stage,
        region=os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1")),
        tenants=tenants,
        students=args.students,
        instructors=args.instructors,
        courses_per_instructor=args.courses_per_instructor,
        random_state=args.random_state,
        start_date=args.start_date,
    )
    validate_ingestion_target(settings.stage, args.dry_run, args.allow_staging)

    specs = user_specs(settings)
    if args.dry_run:
        fake_ids = {
            spec["email"]: stable_id(settings.stage, spec["tenantId"], spec["email"])
            for spec in specs
        }
        print_summary(build_plan(settings, fake_ids), dry_run=True)
        return 0

    password = os.getenv("INGESTION_DEFAULT_PASSWORD")
    if not password:
        raise RuntimeError("Configura INGESTION_DEFAULT_PASSWORD en .env.local")
    if not (
        len(password) >= 10
        and any(char.islower() for char in password)
        and any(char.isupper() for char in password)
        and any(char.isdigit() for char in password)
        and any(not char.isalnum() for char in password)
    ):
        raise RuntimeError(
            "INGESTION_DEFAULT_PASSWORD debe tener al menos 10 caracteres, "
            "mayúscula, minúscula, número y símbolo"
        )

    try:
        import boto3
    except ImportError as error:
        raise RuntimeError(
            "Falta boto3. Ejecuta: python -m pip install -r scripts/ingestion/requirements.txt"
        ) from error

    user_pool_id, tables = load_outputs(settings.stage)
    profile = None if os.getenv("AWS_ACCESS_KEY_ID") else os.getenv("AWS_PROFILE") or None
    session = boto3.Session(profile_name=profile, region_name=settings.region)
    cognito = session.client("cognito-idp")
    print(
        f"Creando/actualizando {len(specs)} usuarios en Cognito "
        f"({settings.stage}, {settings.region})..."
    )
    user_ids = {
        spec["email"]: ensure_cognito_user(cognito, user_pool_id, spec, password)
        for spec in specs
    }
    plan = build_plan(settings, user_ids)
    print("Escribiendo datos en las tablas generadas por CloudFormation...")
    write_plan(session.resource("dynamodb"), tables, plan)
    print_summary(plan, dry_run=False)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
