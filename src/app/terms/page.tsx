import Link from "next/link";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-stone-500 mb-8">
          Last updated: March 5, 2026
        </p>

        <div className="prose prose-stone prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Service Description
            </h2>
            <p className="text-stone-700 leading-relaxed">
              Ritual Song is a music ministry coordination tool operated by
              St. Monica Catholic Community in Santa Monica, California. The
              service provides scheduling, resource access, and communication
              tools for music ministry volunteers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Account Registration
            </h2>
            <p className="text-stone-700 leading-relaxed">
              To use this service, you must create an account and provide
              accurate information. Your account must be approved by a ministry
              administrator before you can access the full features of the
              app. You are responsible for maintaining the security of your
              account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              SMS Terms
            </h2>
            <p className="text-stone-700 leading-relaxed">
              By opting in to text notifications, you agree to the following:
            </p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 mt-2">
              <li>
                <strong>Message frequency:</strong> Varies based on ministry
                activity (typically 2-8 messages per month)
              </li>
              <li>
                <strong>Message and data rates may apply</strong> depending on
                your mobile carrier and plan
              </li>
              <li>
                <strong>Opt out:</strong> Reply STOP to any message to
                unsubscribe from text notifications
              </li>
              <li>
                <strong>Help:</strong> Reply HELP for support information
              </li>
              <li>
                Text notifications are used exclusively for ministry
                coordination, scheduling, and announcements
              </li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-2">
              Supported carriers include AT&T, T-Mobile, Verizon, and most
              major US carriers. For carrier-specific issues, contact your
              carrier directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Acceptable Use
            </h2>
            <p className="text-stone-700 leading-relaxed">
              You agree to use this service only for its intended purpose of
              music ministry coordination. You will not:
            </p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 mt-2">
              <li>
                Share your account credentials with unauthorized individuals
              </li>
              <li>
                Attempt to access data or features beyond your assigned role
              </li>
              <li>
                Use the service to distribute copyrighted material without
                authorization
              </li>
              <li>
                Interfere with the operation of the service or other
                users&apos; access
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Content
            </h2>
            <p className="text-stone-700 leading-relaxed">
              Music resources available through this service are provided for
              ministry use only and may be subject to copyright. Do not
              redistribute copyrighted materials outside of authorized ministry
              activities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Changes to Terms
            </h2>
            <p className="text-stone-700 leading-relaxed">
              We may update these terms from time to time. Continued use of
              the service after changes constitutes acceptance of the updated
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">
              Contact
            </h2>
            <p className="text-stone-700 leading-relaxed">
              For questions about these terms, contact:
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
