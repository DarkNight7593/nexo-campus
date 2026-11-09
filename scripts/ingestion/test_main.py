from __future__ import annotations

import importlib.util
import sys
import unittest
from datetime import date
from pathlib import Path


MODULE_FILE = Path(__file__).with_name("main.py")
SPEC = importlib.util.spec_from_file_location("ingestion_main", MODULE_FILE)
assert SPEC and SPEC.loader
ingestion = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ingestion
SPEC.loader.exec_module(ingestion)


class IngestionPlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = ingestion.Settings(
            stage="dev",
            region="us-east-1",
            tenants=("udemy", "cursarplus"),
            students=6,
            instructors=5,
            courses_per_instructor=5,
            random_state=2026,
            start_date=date(2026, 1, 1),
        )
        specs = ingestion.user_specs(self.settings)
        ids = {
            spec["email"]: ingestion.stable_id(spec["tenantId"], spec["email"])
            for spec in specs
        }
        self.plan = ingestion.build_plan(self.settings, ids)

    def test_original_volume_is_preserved(self) -> None:
        self.assertEqual(len(self.plan["organizations"]), 2)
        self.assertEqual(len(self.plan["profiles"]), 24)
        self.assertEqual(len(self.plan["courses"]), 50)
        self.assertEqual(len(self.plan["schedules"]), 150)
        self.assertEqual(len(self.plan["purchases"]), 300)

    def test_all_references_are_valid(self) -> None:
        profile_ids = {item["userId"] for item in self.plan["profiles"]}
        student_ids = {
            item["userId"] for item in self.plan["profiles"] if item["role"] == "student"
        }
        course_ids = {
            (item["tenantId"], item["courseId"]) for item in self.plan["courses"]
        }
        schedule_ids = {
            (item["tenantId"], item["courseId"], item["scheduleId"])
            for item in self.plan["schedules"]
        }
        self.assertTrue(
            all(item["instructorId"] in profile_ids for item in self.plan["courses"])
        )
        self.assertTrue(
            all(
                (item["tenantId"], item["courseId"]) in course_ids
                for item in self.plan["schedules"]
            )
        )
        self.assertTrue(
            all(
                item["userId"] in student_ids
                and (item["tenantId"], item["courseId"], item["scheduleId"])
                in schedule_ids
                for item in self.plan["purchases"]
            )
        )

    def test_production_ingestion_is_always_blocked(self) -> None:
        with self.assertRaises(RuntimeError):
            ingestion.validate_ingestion_target("production", False, True)
        ingestion.validate_ingestion_target("production", True, False)

    def test_staging_ingestion_requires_explicit_confirmation(self) -> None:
        with self.assertRaises(RuntimeError):
            ingestion.validate_ingestion_target("staging", False, False)
        ingestion.validate_ingestion_target("staging", False, True)


if __name__ == "__main__":
    unittest.main()
