import { BrowserCheck } from 'checkly/constructs'

new BrowserCheck('bc-voice-dictate', {
  name: 'BC Voice – Dictate Mode',
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  code: { entrypoint: './bc-voice-dictate.spec.ts' },
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
