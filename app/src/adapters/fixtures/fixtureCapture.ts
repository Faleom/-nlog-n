// Fixture CapturePort. Returns a bundled photo instead of opening the camera.
// Unblocks anything downstream of a captured image before F.006's real
// DeviceCamera adapter exists, and is also the demo-day API-outage fallback (§11).
import type { CapturePort } from '../ports';

export function createFixtureCapture(): CapturePort {
  return {
    async capturePhoto() {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#d9d2c5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png'),
      );
      return createImageBitmap(blob);
    },
  };
}
