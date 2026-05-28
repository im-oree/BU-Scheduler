/**
 * ═══════════════════════════════════════════════════════════════
 * EMAIL PROVIDERS
 * ═══════════════════════════════════════════════════════════════
 *
 * 👉 TO ADD A NEW EMAIL PROVIDER:
 *
 * Just add a new object to the `EMAIL_PROVIDERS` array below.
 * Each provider needs:
 *   - value: the email suffix (must start with "@")
 *   - label: the friendly display name shown in the picker
 *   - logo:  (optional) a URL or imported asset for the icon
 *   - emoji: (optional) fallback emoji if no logo is provided
 *
 * Example — adding Outlook:
 *   {
 *     value: '@outlook.com',
 *     label: 'Outlook',
 *     emoji: '📧',
 *   }
 *
 * Example — adding a school with a logo:
 *   {
 *     value: '@student.unilag.edu.ng',
 *     label: 'UNILAG Student',
 *     logo: '/logos/unilag.png',
 *   }
 *
 * The first provider in the array becomes the default selection.
 * ═══════════════════════════════════════════════════════════════
 */

export interface EmailProvider {
  value: string;        // e.g. "@gmail.com"
  label: string;        // e.g. "Gmail"
  logo?: string;        // URL/path to icon
  emoji?: string;       // fallback emoji if no logo
}

export const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    value: '@student.babcock.edu.ng',
    label: 'Babcock Student',
    emoji: '🎓',
    // logo: '/logos/babcock.png',  // optional
  },
  {
    value: '@gmail.com',
    label: 'Gmail',
    emoji: '✉️',
  },
  {
    value: '@yahoo.com',
    label: 'Yahoo',
    emoji: '💌',
  },
  // 👇 Add more providers below this line
];

export const DEFAULT_PROVIDER = EMAIL_PROVIDERS[0].value;

export function getProvider(value: string): EmailProvider | undefined {
  return EMAIL_PROVIDERS.find((p) => p.value === value);
}