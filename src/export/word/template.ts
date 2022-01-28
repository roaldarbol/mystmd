import * as fs from 'fs';
import { Document } from 'docx';
import { Node as ProsemirrorNode } from 'prosemirror-model';
import { DocxSerializerState } from 'prosemirror-docx';
import pkgpath from '../../pkgpath';
import { Block, User, Version } from '../../models';
import { getNodesAndMarks } from './schema';
import { ArticleState } from '../utils';
import { createArticleTitle, createReferenceTitle } from './titles';
import { createSingleDocument, getDefaultSerializerOptions } from './utils';
import { ISession } from '../../session/types';

export interface LoadedArticle {
  session: ISession;
  user: User;
  buffers: Record<string, Buffer>;
  block: Block;
  version: Version;
  article: ArticleState;
  opts: Record<string, any>;
}

export async function defaultTemplate(data: LoadedArticle): Promise<Document> {
  const { session, user, buffers, block, version, article } = data;

  const { nodes, marks } = getNodesAndMarks();

  const docxState = new DocxSerializerState(nodes, marks, getDefaultSerializerOptions(buffers));

  // Add the title
  docxState.renderContent(await createArticleTitle(session, block.data));
  // Then render each block
  article.children.forEach(({ state }) => {
    if (!state) return;
    docxState.renderContent(state.doc);
  });

  // render references with title if they exist
  const referencesDocStates = Object.values(article.references)
    .map(({ state }) => state?.doc)
    .filter((docState): docState is ProsemirrorNode<any> => !!docState);
  if (referencesDocStates.length > 0) {
    docxState.renderContent(createReferenceTitle());
  }
  referencesDocStates.forEach((docState) => {
    docxState.renderContent(docState);
  });

  // TODO: this could come from an existing word doc
  const styles = fs.readFileSync(pkgpath('styles/simple.xml'), 'utf-8');

  const doc = createSingleDocument(docxState, {
    title: block.data.title,
    description: block.data.description,
    revision: version.id.version ?? 1,
    creator: `${user.data.display_name} on https://curvenote.com`,
    lastModifiedBy: `${user.data.display_name} (@${user.data.username})`,
    keywords: block.data.tags.join(', '),
    externalStyles: styles,
  });

  return doc;
}