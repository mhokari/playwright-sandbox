import { BrowserCheck } from 'checkly/constructs'

new BrowserCheck('bc-voice-text-input', {
  name: 'BC Voice – Text Input',
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  code: { entrypoint: './bc-voice-text-input.spec.ts' },
  playwrightConfig: {
    use: {
      permissions: ['microphone'],
      launchOptions: {
        args: [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
        ],
      },
    },
  },
})
