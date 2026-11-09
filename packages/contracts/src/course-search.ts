export const coursesIndex = 'courses-v1'

/** Shared physical contract for every producer and consumer of the course index. */
export const courseIndexDefinition = {
  settings: {
    analysis: {
      analyzer: {
        autocomplete_analyzer: {
          tokenizer: 'autocomplete_tokenizer',
          filter: ['lowercase']
        }
      },
      tokenizer: {
        autocomplete_tokenizer: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
          token_chars: ['letter', 'digit']
        }
      }
    }
  },
  mappings: {
    properties: {
      tenantId: { type: 'keyword' },
      courseId: { type: 'keyword' },
      instructorId: { type: 'keyword' },
      name: {
        type: 'text',
        fields: { prefix: { type: 'text', analyzer: 'autocomplete_analyzer' } }
      },
      description: { type: 'text' },
      startDate: { type: 'date', format: 'yyyy-MM-dd' },
      endDate: { type: 'date', format: 'yyyy-MM-dd' },
      price: { type: 'float' },
      schedules: {
        type: 'nested',
        properties: {
          scheduleId: { type: 'keyword' },
          days: { type: 'keyword' },
          startTime: { type: 'keyword' },
          endTime: { type: 'keyword' },
          capacity: { type: 'integer' },
          occupiedCount: { type: 'integer' },
          status: { type: 'keyword' }
        }
      }
    }
  }
} as const
