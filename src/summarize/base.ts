/* eslint-disable import/no-cycle */
import {
  CellOutput,
  CellOutputMimeTypes,
  OutputSummaryKind,
  OutputSummaryEntry,
} from '@curvenote/blocks';
import { IFileObjectFactoryFn } from '../files';

const NUM_CHARS = 25000;
const TRUNCATED_CHARS_COUNT = 64;

class Summarizer {
  fileFactory: IFileObjectFactoryFn;

  item: CellOutput;

  basepath: string;

  constructor(fileFactory: IFileObjectFactoryFn, item: CellOutput, basepath: string) {
    this.fileFactory = fileFactory;
    this.item = item;
    this.basepath = basepath;
  }

  test(outputItem: CellOutput): boolean {
    throw new Error('test not implemented in base class');
  }

  static new(
    fileFactory: IFileObjectFactoryFn,
    kind: OutputSummaryKind,
    item: CellOutput,
    basepath: string,
  ): Summarizer | null {
    throw new Error('Implemented in factory.ts to avoid dependency cycles.');
  }

  kind(): OutputSummaryKind {
    return OutputSummaryKind.unknown;
  }

  $makeFilepath(contentType: CellOutputMimeTypes): string {
    return `${this.basepath}.${contentType.replace('/', '_')}`;
  }

  /**
   *  Returns a modified version of the cell otuput containing the reamining data for processing
   * if any or null
   */
  next(): CellOutput {
    throw new Error('`next()` not implemented in base class');
  }

  prepare(): OutputSummaryEntry {
    throw new Error('prepare not implemented in base class');
  }

  async process(summary: OutputSummaryEntry): Promise<OutputSummaryEntry> {
    let { content } = summary;
    if (summary.content && summary.content.length > NUM_CHARS) {
      const path = this.$makeFilepath(summary.content_type);
      const outputFile = this.fileFactory(path);
      await outputFile.writeString(summary.content as string, summary.content_type);
      content = `${summary.content.slice(0, TRUNCATED_CHARS_COUNT)}...`;
      return {
        kind: summary.kind,
        content_type: summary.content_type,
        content: content ?? '',
        path,
      };
    }
    return {
      kind: summary.kind,
      content_type: summary.content_type,
      content: content ?? '',
    };
  }
}

export default Summarizer;
