// Ambient declarations for packages without bundled types

declare module 'fluent-ffmpeg' {
  interface FfmpegCommand {
    input(source: string): this;
    inputOptions(options: string[]): this;
    outputOptions(options: string[]): this;
    output(target: string): this;
    on(event: 'end', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    on(event: string, cb: (...args: any[]) => void): this;
    run(): void;
  }
  interface FfmpegStatic {
    (): FfmpegCommand;
    setFfmpegPath(path: string): void;
  }
  const ffmpeg: FfmpegStatic;
  export = ffmpeg;
}

declare module '@ffmpeg-installer/ffmpeg' {
  const installer: { path: string; version: string; url: string };
  export = installer;
}
