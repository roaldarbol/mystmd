/* eslint-disable no-console */
/* eslint-disable max-classes-per-file */

export type Metadata = {
  name: string;
  size: number; // This is transformed on the response
  etag: string;
  md5Hash: string;
  contentType: string;
  bucket: string;
  metadata: Record<string, string>;
};

export interface IFileObject {
  get id(): string;
  writeString(data: string, contentType: string): Promise<void>;
  writeBase64(data: string): Promise<void>;
  setContentType(contentType: string): Promise<Metadata>;
  sign(): Promise<string>;
}

export class StubFileObject implements IFileObject {
  path: string;

  constructor(path: string) {
    this.path = path;
    console.debug('StubFileObject created', path);
  }

  get id() {
    return '';
  }

  writeString(data: string, contentType: string): Promise<void> {
    console.debug('StubFileObject:writeString', data, contentType);
    return Promise.resolve();
  }

  writeBase64(data: string): Promise<void> {
    console.debug('StubFileObject:writeBase64', data);
    return Promise.resolve();
  }

  setContentType(contentType: string): Promise<Metadata> {
    console.debug('StubFileObject:setContentType', contentType);
    return Promise.resolve({} as Metadata);
  }

  async sign() {
    console.debug('StubFileObject:sign');
    return 'stub-file-signature';
  }
}

export type IFileObjectFactoryFn = (path: string) => IFileObject;
