import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marshall } from '@aws-sdk/util-dynamodb'

const send = vi.hoisted(() => {
  process.env.DATA_BUCKET = 'archive-bucket'
  return vi.fn()
})

vi.mock('@cloud-learning/aws-clients', () => ({ s3: { send } }))

import { handler } from './handler.js'

beforeEach(() => send.mockReset().mockResolvedValue({}))

describe('purchase archiver idempotency', () => {
  it('uses stable stream metadata for the object key and timestamp', async () => {
    const record = {
      eventID: 'event-123',
      eventName: 'INSERT' as const,
      dynamodb: {
        ApproximateCreationDateTime: 1_767_225_600,
        SequenceNumber: '42',
        NewImage: marshall({
          tenantId: 'tenant-a', userId: 'user-1', purchaseId: 'purchase-1', courseId: 'course-1', scheduleId: 'schedule-1',
          status: 'reserved', amount: 10, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
        })
      }
    }

    await handler({ Records: [record] } as never, {} as never, vi.fn())
    await handler({ Records: [record] } as never, {} as never, vi.fn())

    const first = send.mock.calls[0]?.[0].input
    const second = send.mock.calls[1]?.[0].input
    expect(first.Key).toBe('purchases/tenant-a/2026/01/01/purchase-1/event-123.json')
    expect(second.Key).toBe(first.Key)
    expect(second.Body).toBe(first.Body)
  })
})
