import { AtlasApp } from "@/components/AtlasApp";
import { BRAND } from "@/lib/brand";
import { getProviderInfo } from "@/lib/market-data/server";

export const dynamic = "force-dynamic";

export default function Home() {
  const provider = getProviderInfo();
  return (
    <>
      <a className="skip" href="#atlas">
        Skip to the atlas
      </a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label={`${BRAND.product} home`}>
          <span className="wordmark-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="wordmark-name">{BRAND.product}</span>
          <span className="wordmark-by">{BRAND.byline}</span>
        </a>
        <nav aria-label="Page">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
      </header>

      <main>
        <AtlasApp provider={provider} />

        <section id="how" className="prose-section" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title">How it works</h2>
          <div className="prose-grid">
            <div>
              <h3>Shapes are sized by value</h3>
              <p>
                Each holding is a rectangle whose <strong>area is proportional to its current value</strong>. Holdings are
                grouped into outlined regions — by sector or by instrument type. A thin gap separates shapes, so very small
                holdings can look slightly smaller than their exact share, never larger. The scale key under the map shows the
                area of 1%.
              </p>
            </div>
            <div>
              <h3>Colour and texture mean something</h3>
              <p>
                Colour shows the group (a sector or a type). Texture shows the instrument type: funds and ETFs are hatched,
                cash is dotted. Funds are kept as funds — what they hold underneath isn&apos;t broken down, so a fund is never
                given a single business sector.
              </p>
            </div>
            <div>
              <h3>Calculations, not advice</h3>
              <p>
                Totals, shares and concentration figures are plain arithmetic on the values you enter. Portfolio Atlas does
                not rate your portfolio, predict returns or tell you what to buy or sell. It shows only the holdings you
                enter, not your total wealth.
              </p>
            </div>
            <div>
              <h3>One currency, no conversion</h3>
              <p>
                Pick one currency and enter every holding&apos;s current value in it. The app doesn&apos;t fetch prices or convert
                currencies. Short positions, loans and other liabilities aren&apos;t supported in this version.
              </p>
            </div>
          </div>
        </section>

        <section id="privacy" className="prose-section" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="section-title">Privacy</h2>
          <div className="prose-grid">
            <div>
              <h3>Your holdings stay in your browser</h3>
              <p>
                Holdings are saved only in this browser&apos;s local storage on this device. They are not sent to a server and
                there are no accounts. Local storage can be cleared by the browser or by you, and it doesn&apos;t sync between
                devices — use “Save file” to keep your own copy.
              </p>
            </div>
            <div>
              <h3>What leaves your device</h3>
              <p>
                {provider.enabled
                  ? "When you search for a security, only the text you type in the identifier box is sent to look it up. Values and the rest of your portfolio are never sent."
                  : "Security search is turned off, so nothing about your holdings leaves your device."}{" "}
                Images and portfolio files are created on your device. There are no analytics that capture holdings or values.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          <strong>{BRAND.fullName}</strong>. An informational visualization tool. Not investment, tax or financial advice.
          {BRAND.company} is not a licensed financial adviser or institution.
        </p>
        {provider.enabled && (
          <p className="fine">
            Security search: {provider.isDemo ? "a small built-in demo list (not live market data)." : provider.attribution}
          </p>
        )}
      </footer>
    </>
  );
}
