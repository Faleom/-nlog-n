// Fixture FaceDetectPort. Always returns zero faces — safe default for
// screens that don't test the blur path. F.006's real BlazeFace adapter
// replaces this. Never used for verifying the blur guarantee itself.
import type { FaceDetectPort } from '../ports';

export function createFixtureFaceDetect(): FaceDetectPort {
  return {
    async findFaces() {
      return [];
    },
  };
}
