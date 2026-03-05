import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/join"
          className="text-sm text-violet-600 hover:text-violet-700 transition-colors mb-8 inline-block"
        >
          &larr; Back to Sign Up
        </Link>

        <h1 className="text-2xl font-semibold text-stone-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          Last updated: March 5, 2026
        </p>

        <div className="prose prose-stone prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              What We Collect
            </h2>
            <p className="text-stone-700 leading-relaxed">
              When you sign up for St. Monica Music Ministry, we collect the
              following information:
            </p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 mt-2">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number (optional)</li>
              <li>Musical role (vocalist, instrumentalist, cantor)</li>
              <li>Voice part and/or instrument details</li>
              <li>Ensemble membership</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              How We Use Your Information
            </h2>
            <p className="text-stone-700 leading-relaxed">
              Your information is used solely for ministry coordination
              purposes:
            </p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 mt-2">
              <li>Scheduling and coordinating music ministry activities</li>
              <li>
                Sending notifications about rehearsals, liturgies, and ministry
                updates
              </li>
              <li>Maintaining a member directory for ministry leaders</li>
              <li>
                Providing access to music resources, schedules, and planning
                tools
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Text Messaging (SMS)
            </h2>
            <p className="text-stone-700 leading-relaxed">
              If you opt in to text messaging, we will send you SMS
              notifications related to ministry activities. You may opt out at
              any time by replying STOP to any message. Message and data rates
              may apply. Message frequency varies based on ministry activity.
            </p>
            <p className="text-stone-700 leading-relaxed mt-2">
              We do not use your phone number for marketing purposes or share
              it with third parties for their marketing use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Data Sharing
            </h2>
            <p className="text-stone-700 leading-relaxed">
              We do not sell, rent, or share your personal information with
              third parties for their commercial purposes. Your information is
              shared only with:
            </p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 mt-2">
              <li>
                Ministry leaders and administrators who need it for
                coordination
              </li>
              <li>
                Service providers (Twilio for SMS, Resend for email) who
                process communications on our behalf
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Data Security
            </h2>
            <p className="text-stone-700 leading-relaxed">
              Your data is stored securely using industry-standard encryption
              and access controls. We use Supabase for data storage, which
              provides enterprise-grade security including encryption at rest
              and in transit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Your Rights
            </h2>
            <p className="text-stone-700 leading-relaxed">
              You may request to view, update, or delete your personal
              information at any time by contacting us. You can also update
              your profile information directly through the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Contact
            </h2>
            <p className="text-stone-700 leading-relaxed">
              For questions about this privacy policy or your data, contact:
            </p>
            <p className="text-stone-700 mt-2">
              St. Monica Music Ministry
              <br />
              <a
                href="mailto:music@stmonica.net"
                className="text-violet-600 hover:text-violet-700"
              >
                music@stmonica.net
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
