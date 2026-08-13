import { BrowserCheck } from 'checkly/constructs'

new BrowserCheck('bc-voice-use-voice', {
  name: 'BC Voice – Use Voice Mode',
  frequency: 5,
  locations: ['us-east-1', 'eu-west-1'],
  code: { entrypoint: './bc-voice-use-voice.spec.ts' },
  playwrightConfig: {
    use: {
      permissions: ['microphone'],
      launchOptions: {
        args: [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          // Relative to the check's cwd (/check/<uuid>), which is where Checkly
          // places the check root — NOT the same as an absolute path from '/'.
          '--use-file-for-fake-audio-capture=__checks__/marathon-message.wav',
        ],
      },
    },
  },
})
