import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";

// Every statement on this page describes what the application actually does,
// verified against the code rather than written from a template:
//   • no cookies are set for public visitors (confirmed: zero Set-Cookie on
//     public routes and on /go/[slug])
//   • analytics (Step 7.6) is Google Analytics 4, loaded only when a
//     measurement ID is configured, and run with client_storage:'none' so it
//     writes no cookie, with advertising signals and personalisation off, and
//     with page URLs reported path-only so search terms are never sent
//   • no client-side storage is used (no localStorage/sessionStorage/
//     document.cookie in src/)
//   • affiliate_clicks stores exactly the columns listed below, and ip_hash
//     is never written by record_affiliate_click()
// If any of that changes — particularly Step 7.6 (analytics) — this page has
// to change with it, in the same commit.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Wellness Center USA handles information: no visitor cookies, cookieless analytics that never sees your searches, and exactly what is recorded when an affiliate link is clicked.",
  alternates: { canonical: `${siteUrl}/privacy-policy` },
  robots: { index: true, follow: true },
};

const UPDATED = "September 17, 2026";

export default function PrivacyPolicyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      lead="This policy describes what information Wellness Center USA collects, what it does not collect, and how the information it does collect is used."
      updated={UPDATED}
    >
      <StaticSection title="The short version">
        <p>
          You can browse this entire site without an account, and we do not set any cookies while you do. We use
          Google Analytics to count visits, but we run it in a deliberately limited way: it stores no cookie, it
          cannot recognise you between visits, and it is never told what you searched for. We use no advertising
          pixels and no cross-site tracking. The only other visitor information we record is a small amount of
          non-identifying data at the moment someone clicks through to a merchant, described in full below.
        </p>
      </StaticSection>

      <StaticSection title="Information we collect">
        <p>
          <strong>When you click an affiliate link.</strong> When you use a &ldquo;View official offer&rdquo; link,
          we record a single row describing that click before sending you to the merchant. It contains:
        </p>
        <ul>
          <li>which product was clicked, and the date and time</li>
          <li>the page on this site you clicked from</li>
          <li>the referring website, if you arrived here from another site</li>
          <li>which link on the page you used, where the page distinguishes them</li>
          <li>campaign tags (such as UTM values) if they were present in the address you arrived with</li>
          <li>a broad device category — mobile, tablet, desktop, or unknown</li>
        </ul>
        <p>
          That record is not connected to you. It contains no name, no email address, no account identifier, no
          cookie value, and no IP address, and there is nothing in it that links one click to another.
        </p>
        <p>
          <strong>When you contact us.</strong> If you email us, we receive whatever you choose to put in that
          message, and we use it to reply.
        </p>
        <p>
          <strong>Staff accounts.</strong> This site has a private area used only by the site owner and the
          editorial team who write its content. Those accounts hold an email address, a display name, a role, and a
          password stored in hashed form by our authentication provider. Accounts are created by the site owner —
          there is no public sign-up, and visitors cannot register.
        </p>
      </StaticSection>

      <StaticSection title="What we do not collect">
        <p>To be specific about the things a site like this often does, but this one does not:</p>
        <ul>
          <li>we do not store your IP address in our records</li>
          <li>we do not use advertising pixels, retargeting, or cross-site tracking</li>
          <li>we do not build a profile of you or track you between visits</li>
          <li>we do not send what you type into search to anyone</li>
          <li>we do not ask for a name, address, phone number, or payment details</li>
          <li>we do not take payments — no purchase is ever made on this site</li>
          <li>we do not sell, rent, or trade information about visitors</li>
        </ul>
      </StaticSection>

      <StaticSection title="Analytics">
        <p>
          We use Google Analytics to understand how many people visit and which pages they read. Google acts as a
          processor for us, and the data is held in Google&apos;s systems under their terms.
        </p>
        <p>We have configured it more narrowly than its defaults, specifically:</p>
        <ul>
          <li>
            <strong>No cookie and no stored identifier.</strong> Analytics runs with browser storage switched off,
            so nothing is written to your device and the same visitor cannot be recognised on a later visit. This
            makes our visitor counts less accurate, which we accept.
          </li>
          <li>
            <strong>No advertising features.</strong> Google Signals, ad personalisation and advertising data
            sharing are all disabled, so this data is not used to target advertising to you anywhere.
          </li>
          <li>
            <strong>No search terms.</strong> Page addresses are reported without their query string, so what you
            type into our search box is never sent to Google. We record only that a search happened and whether it
            returned any results.
          </li>
          <li>
            <strong>No account or staff activity.</strong> Analytics loads only on the public pages. The private
            administrative area is excluded entirely.
          </li>
        </ul>
        <p>
          Your IP address is used by Google to derive an approximate location and is not retained by us. We never
          send Google your name, your email address, anything you type into a form, or the address of the merchant
          you clicked through to.
        </p>
      </StaticSection>

      <StaticSection title="Cookies and similar technologies">
        <p>
          Browsing the public site still sets no cookies at all, including for analytics, and the site does not use
          browser storage such as localStorage. There is no cookie banner because there is nothing to consent to.
        </p>
        <p>
          A session cookie is used in one place only: when a member of the site owner&apos;s or editorial team signs
          in to the private administrative area. It exists to keep that person signed in and is not used for
          visitors, tracking, or advertising.
        </p>
      </StaticSection>

      <StaticSection title="How we use information">
        <p>Click information is used to understand which products and pages people find useful — for example, which product pages lead to interest in an offer. Because the data is not tied to individuals, this analysis is inherently aggregate.</p>
        <p>Staff account information is used to sign the right people in and to determine what each of them is permitted to edit.</p>
        <p>Messages you send us are used to respond to you.</p>
      </StaticSection>

      <StaticSection title="Service providers">
        <p>
          We use Supabase to host the database, manage staff authentication, and store images used on the site. Our
          web hosting provider processes the requests needed to deliver pages to your browser; as with any website,
          that necessarily involves technical details such as your IP address being handled in order to send you a
          response, even though we do not keep it in our own records.
        </p>
        <p>These providers process information so that we can operate the site. We do not share information with anyone else for their own marketing purposes.</p>
      </StaticSection>

      <StaticSection title="Merchant sites and what happens after you leave">
        <p>
          This is an important distinction. Everything above describes information handled by Wellness Center USA.
          Once you follow a link to a merchant, you are on a different company&apos;s website, and their privacy
          practices apply instead of ours — not this policy.
        </p>
        <p>
          Merchants commonly set their own cookies, run their own analytics and advertising tools, and collect the
          information needed to complete a purchase, including payment details. We have no control or visibility
          over any of that. If you buy something, the merchant — not this site — handles your order and your
          payment information, and we never receive your payment details.
        </p>
        <p>
          Where an affiliate programme reports back to us, it does so to attribute a commission. We encourage you to
          read the privacy policy of any merchant before purchasing.
        </p>
      </StaticSection>

      <StaticSection title="How long information is kept">
        <p>
          Click records are kept while the product they refer to exists on the site; if that product record is
          removed, its click records are removed with it. Staff accounts are kept while the person still needs
          access. Emails you send us are kept as long as needed to deal with what you wrote about.
        </p>
      </StaticSection>

      <StaticSection title="Security">
        <p>
          Access to the database is restricted at the database itself, so each account can only reach the records
          its role permits, and the private administrative area requires signing in. Merchant destination addresses
          are never exposed in the public pages of this site. Traffic to the site is served over an encrypted
          connection.
        </p>
        <p>No website can promise perfect security, and we do not claim to. What we can say is that the amount of visitor information held here is deliberately very small.</p>
      </StaticSection>

      <StaticSection title="Children">
        <p>
          This site is intended for adults and is not directed to children under 13. We do not knowingly collect
          information from children. Health and wellness products should be considered by an adult, and where
          relevant discussed with a healthcare professional.
        </p>
      </StaticSection>

      <StaticSection title="Your choices">
        <p>
          Because click records contain no identifier, we generally cannot locate records &ldquo;belonging&rdquo; to
          a particular person — there is nothing in them to match against. That is a consequence of collecting so
          little, rather than a refusal to help.
        </p>
        <p>
          If you hold a staff account, or you have emailed us and want that correspondence removed, contact us and
          we will deal with it. Depending on where you live you may have additional rights over personal
          information; we would rather point you to a real conversation than list guarantees we have not had
          reviewed, so please get in touch.
        </p>
      </StaticSection>

      <StaticSection title="Changes to this policy">
        <p>
          If this policy changes, the date at the top of the page changes with it. If we ever widen what analytics
          collects — cookies, search terms, or anything that could identify you — this page will say so before or
          when that happens, and we would look at whether consent should be asked for first.
        </p>
      </StaticSection>

      <StaticSection title="Contact">
        <p>
          Questions about this policy can be sent through our{" "}
          <Link href="/contact">contact page</Link>. You may also want to read our{" "}
          <Link href="/affiliate-disclosure">affiliate disclosure</Link>, which explains how the links on this site
          work.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
