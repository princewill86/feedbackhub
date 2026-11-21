import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { platformSettings } from './schema';

const documents = {
  terms: {
    title: 'Terms of Service',
    description: 'Terms for using this FeedbackHub installation as an account holder, workspace member, or visitor.',
    body: `## Using FeedbackHub

FeedbackHub provides tools for collecting feedback, discussing requests, and publishing roadmaps and product updates. These terms cover use of this installation by account holders, workspace members, and visitors.

## Accounts and workspaces

Keep your sign-in information private and provide accurate account information. Workspace owners are responsible for choosing who can access their workspace and deciding what to publish. Feedback that is published on a public board can be read and shared by visitors.

## Content and acceptable use

You retain ownership of the content you submit. By submitting it, you allow this installation to store and display it as needed to provide the service and follow the workspace’s visibility settings. Submit only content you have permission to share. Do not post unlawful material, impersonate another person, send spam, or interfere with the service or other users’ access.

## Plans and payments

If online billing is enabled, review the price, term, and renewal details in checkout before paying. The payment provider handles the payment. Recurring subscriptions and prepaid terms have different renewal rules. Contact the operator of this installation for billing questions or refund requests.

## Changes and questions

The operator may update these terms to reflect changes to the service. Direct questions about the terms, your account, or installation-specific agreements to the operator of this FeedbackHub installation.`
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How account information, workspace content, and payment records are handled by a FeedbackHub installation.',
    body: `## Information processed

FeedbackHub stores the name and email address you provide, along with account and session records. Workspace activity can include membership details, feedback, votes, comments, invitations, and notification history. Feedback forms can also accept anonymous submissions.

## How information is used

This information supports account access, workspace collaboration, public publishing, security, customer communications, and billing where enabled. Email verification, reset links, and invitations may be sent through the mail transport configured by the installation operator.

## Visibility and sharing

Workspace members see information according to their access. Workspace owners can publish selected feedback and product updates for public viewing. Connected services may receive the data needed for the feature used, such as delivery details for email, payment references for billing, or event identifiers sent to an enabled webhook destination.

## Cookies and payment information

FeedbackHub uses session cookies to keep users signed in. When you use a hosted payment page, your payment details go to that provider. FeedbackHub stores the references and subscription or payment status needed to manage your access.

## Retention and privacy requests

The operator of this installation manages retention and handles requests about personal information. If your information is part of a workspace, its owner can help identify the relevant content. Contact the installation operator to ask about retention, obtain a copy of your information, request a correction, or request deletion.`
  }
} as const;

export type LegalDocument = keyof typeof documents;
export const legalKey = (document: LegalDocument) => `legal.${document}`;
export const isLegalDocument = (value: unknown): value is LegalDocument => value === 'terms' || value === 'privacy';

export async function loadLegalDocument(document: LegalDocument) {
  const [saved] = await getDb().select({ body: platformSettings.value, updatedAt: platformSettings.updatedAt })
    .from(platformSettings).where(eq(platformSettings.key, legalKey(document)));
  return { ...documents[document], body: saved?.body ?? documents[document].body, updatedAt: saved?.updatedAt ?? null };
}
