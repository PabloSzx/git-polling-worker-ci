declare module "folder-hash" {
  export type Rules = {
    exclude?: string[] | ((file: string) => boolean);
    include?: string[] | ((file: string) => boolean);
    matchBasename?: boolean;
    matchPath?: boolean;
    ignoreBasename?: boolean;
    ignoreRootName?: boolean;
  };

  export type SymLinkOptions = {
    include?: boolean;
    ignoreBasename?: boolean;
    ignoreTargetPath?: true;
    ignoreTargetContent?: boolean;
    ignoreTargetContentAfterError?: boolean;
  };

  export type Options = {
    algo?: string;
    encoding?: string;
    files?: Rules;
    folders?: Rules;
    symLinks?: SymLinkOptions;
  };

  export interface ElementHash {
    name: string;
    hash: string;
    children?: ElementHash[];
    toString(): string;
  }

  export function hashElement(name: string, dir?: string, options?: Options): Promise<ElementHash>;
}
