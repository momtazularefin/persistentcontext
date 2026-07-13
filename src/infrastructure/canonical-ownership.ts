export type OwnershipClass = 'protocol' | 'project' | 'generated' | 'runtime';

export type OwnershipPatterns = Record<OwnershipClass, string[]>;

const OWNERSHIP_CLASSES: OwnershipClass[] = ['protocol', 'project', 'generated', 'runtime'];

function escapeRegularExpression(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

export function globToRegularExpression(glob: string): RegExp {
  let expression = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index] as string;
    if (character === '*') {
      if (glob[index + 1] === '*') {
        expression += '.*';
        index += 1;
      } else {
        expression += '[^/]*';
      }
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += escapeRegularExpression(character);
    }
  }
  return new RegExp(`${expression}$`);
}

export function matchingOwnershipClasses(
  relativePath: string,
  patterns: OwnershipPatterns,
): OwnershipClass[] {
  return OWNERSHIP_CLASSES.filter((ownership) =>
    patterns[ownership].some((pattern) => globToRegularExpression(pattern).test(relativePath)),
  );
}
