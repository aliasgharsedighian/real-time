import { describe, expect, it } from "vitest";
import { validateUpload, type UploadPolicy } from "./api";
const policy: UploadPolicy = {
  avatarMaxBytes: 5,
  imageMaxBytes: 10,
  videoMaxBytes: 100,
  videoMaxSeconds: 300,
  audioMaxSeconds: 300,
  audioMaxBytes: 20 * 1024 * 1024,
  audioMimeTypes: ["audio/webm", "audio/mp4"],
  imageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  videoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
};
function file(type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "file", { type });
}
describe("upload validation using the server policy", () => {
  it("allows video only in chats", () => {
    expect(() => validateUpload(file("video/mp4", 20), policy)).not.toThrow();
    expect(() => validateUpload(file("video/mp4", 20), policy, true)).toThrow(
      "JPEG",
    );
  });
  it("uses separate avatar, image, and video size limits", () => {
    expect(() => validateUpload(file("image/png", 6), policy, true)).toThrow(
      "File must",
    );
    expect(() => validateUpload(file("image/png", 11), policy)).toThrow(
      "File must",
    );
    expect(() => validateUpload(file("video/webm", 101), policy)).toThrow(
      "File must",
    );
    expect(() => validateUpload(file("image/webp", 10), policy)).not.toThrow();
  });
  it("accepts voice audio in chats, enforces its limit, and rejects audio avatars", () => {
    expect(() =>
      validateUpload(file("audio/webm;codecs=opus", 10), policy),
    ).not.toThrow();
    expect(() => validateUpload(file("audio/mp4", 10), policy, true)).toThrow(
      "JPEG",
    );
    expect(() =>
      validateUpload(file("audio/webm", policy.audioMaxBytes + 1), policy),
    ).toThrow("File must");
  });
  it("rejects empty files and executable image formats", () => {
    expect(() => validateUpload(file("image/jpeg", 0), policy)).toThrow();
    expect(() => validateUpload(file("image/svg+xml", 3), policy)).toThrow();
  });
});
