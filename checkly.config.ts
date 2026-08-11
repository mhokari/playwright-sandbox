import { defineConfig } from 'checkly'

export default defineConfig({
  projectName: 'Brand Concierge Voice',
  logicalId: 'bc-voice-project',
  checks: {
    locations: ['us-east-1', 'eu-west-1'],
    checkMatch: '**/*.check.ts',
    browserChecks: { testMatch: '**/*.spec.ts' },
  },
})
