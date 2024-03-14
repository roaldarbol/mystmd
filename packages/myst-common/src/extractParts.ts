import type { Block } from 'myst-spec-ext';
import type { GenericNode, GenericParent } from './types.js';
import { remove } from 'unist-util-remove';
import { selectAll } from 'unist-util-select';
import { copyNode, toText } from './utils.js';

function coercePart(part?: string | string[]): string[] {
  if (!part) {
    // Prevent an undefined, null or empty part comparison
    return [];
  }
  return typeof part === 'string' ? [part] : part;
}

/**
 * Selects the block node(s) based on part (string) or tags (string[]).
 * If `part` is a string array, any of the parts will be treated equally.
 */
export function selectBlockParts(tree: GenericParent, part?: string | string[]): Block[] {
  const parts = coercePart(part);
  if (parts.length === 0) return [];
  const blockParts = selectAll('block', tree).filter((block) => {
    return parts
      .map((p) => {
        return (
          block.data?.part === p ||
          (block.data?.tags && Array.isArray(block.data.tags) && block.data.tags.includes(p))
        );
      })
      .reduce((a, b) => a || b, false);
  });
  return blockParts as Block[];
}

function createPartBlock(
  children: GenericNode[],
  part: string,
  opts?: {
    removePartData?: boolean;
  },
) {
  const block: GenericParent = { type: 'block', children };
  if (!opts?.removePartData) {
    block.data ??= {};
    block.data.part = part;
  }
  return block;
}

/**
 * Extract implicit part based on heading name
 *
 * Given a tree, search children at the root or block level for a heading
 * with text matching parts. If such heading is encountered, return a copy of
 * the subsequent paragraph nodes until a non-paragraph node is encountered.
 * Heading and paragraph nodes in the original tree are marked for deletion.
 *
 * Ignores anything that is already part of a block with explicit part.
 */
export function extractImplicitPart(
  tree: GenericParent,
  part?: string | string[],
  opts?: {
    removePartData?: boolean;
  },
): GenericParent | undefined {
  const parts = coercePart(part);
  if (parts.length === 0) return;
  let insideImplicitPart = false;
  const blockParts: GenericNode[] = [];
  let paragraphs: GenericNode[] = [];
  tree.children.forEach((child, index) => {
    // Add this paragraph to the part
    if (insideImplicitPart && child.type === 'paragraph') {
      paragraphs.push(copyNode(child));
      child.type = '__part_delete__';
    }
    // Stop adding things if we didn't just add a paragraph OR we are at the last child
    if (child.type !== '__part_delete__' || index === tree.children.length - 1) {
      insideImplicitPart = false;
      if (paragraphs.length > 0) {
        blockParts.push(createPartBlock(paragraphs, parts[0], opts));
        paragraphs = [];
        selectAll('__part_heading__', tree).forEach((node) => {
          node.type = '__part_delete__';
        });
      }
    }
    if (child.type === 'block') {
      // Do not search blocks already marked explicitly as parts
      if (child.data?.part) return;
      // Do not recursively search beyond top-level blocks on root node
      if (tree.type !== 'root') return;
      const blockPartsTree = extractImplicitPart(child as GenericParent, parts);
      if (blockPartsTree) blockParts.push(...blockPartsTree.children);
    } else if (child.type === 'heading' && parts.includes(toText(child).toLowerCase())) {
      // Start adding paragraphs to the part after this heading
      insideImplicitPart = true;
      child.type = '__part_heading__';
    }
  });
  // Restore part headings if they did not contain any paragraphs
  selectAll('__part_heading__', tree).forEach((node) => {
    node.type = 'heading';
  });
  if (blockParts.length === 0) return;
  const partsTree = { type: 'root', children: blockParts } as GenericParent;
  remove(tree, '__part_delete__');
  return partsTree;
}

/**
 * Returns a copy of the block parts and removes them from the tree.
 */
export function extractPart(
  tree: GenericParent,
  part?: string | string[],
  opts?: {
    /** Helpful for when we are doing recursions, we don't want to extract the part again. */
    removePartData?: boolean;
    /** Ensure that blocks are by default turned to visible within the part */
    keepVisibility?: boolean;
    /** Provide an option so implicit section-to-part behavior can be disabled */
    requireExplicitPart?: boolean;
  },
): GenericParent | undefined {
  const partStrings = coercePart(part);
  if (partStrings.length === 0) return;
  const blockParts = selectBlockParts(tree, part);
  if (blockParts.length === 0) {
    if (opts?.requireExplicitPart) return;
    return extractImplicitPart(tree, partStrings);
  }
  const children = copyNode(blockParts).map((block) => {
    // Ensure the block always has the `part` defined, as it might be in the tags
    block.data ??= {};
    block.data.part = partStrings[0];
    if (
      block.data.tags &&
      Array.isArray(block.data.tags) &&
      block.data.tags.reduce((a, t) => a || partStrings.includes(t), false)
    ) {
      block.data.tags = block.data.tags.filter((tag) => !partStrings.includes(tag)) as string[];
      if ((block.data.tags as string[]).length === 0) {
        delete block.data.tags;
      }
    }
    if (opts?.removePartData) delete block.data.part;
    // The default is to remove the visibility on the parts
    if (!opts?.keepVisibility) delete block.visibility;
    return block;
  });
  const partsTree = { type: 'root', children } as GenericParent;
  // Remove the block parts from the main document
  blockParts.forEach((block) => {
    (block as any).type = '__delete__';
  });
  remove(tree, '__delete__');
  return partsTree;
}
