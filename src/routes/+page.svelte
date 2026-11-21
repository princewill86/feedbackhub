<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();

  const features = [
    { name: 'Feedback boards', detail: 'Collect ideas and bug reports in one place. Publish selected requests so customers can follow them.', mark: '↳' },
    { name: 'Prioritization', detail: 'Use votes, comments, products, and statuses to decide what to work on next.', mark: '↑' },
    { name: 'Roadmaps and changelogs', detail: 'Share what’s planned, schedule release notes, and show customers what shipped.', mark: '→' },
    { name: 'Analytics and integrations', detail: 'Explore submission trends, export feedback, and connect the tools your team already uses.', mark: '↗' }
  ];

  const questions = [
    { question: 'Can I keep feedback private?', answer: 'Yes. A new workspace starts private. The owner can enable a public board and choose which individual requests to publish.' },
    { question: 'Can I collect feedback on my own website?', answer: 'Yes. Workspace owners can create an embeddable form and choose which websites can display it. Submissions arrive in the private workspace for review.' },
    { question: 'Can different teams work separately?', answer: 'Yes. Each workspace has its own members, products, feedback, and publishing settings.' }
  ];
</script>

<svelte:head>
  <title>{data.settings.name} | Customer feedback for product teams</title>
  <meta name="description" content={data.settings.seoDescription} />
</svelte:head>

<div class="landing">
  <section class="landing-hero site-width">
    <div class="hero-copy">
      <p class="eyebrow"><span aria-hidden="true"></span> Customer feedback for product teams</p>
      <h1>{data.settings.homepageTitle}</h1>
      <p class="hero-description">{data.settings.homepageDescription}</p>
      <div class="hero-actions">
        <a class="button" href="/auth/register">Create your workspace <span aria-hidden="true">↗</span></a>
        <a class="outline-button" href="#workflow">See how it works <span aria-hidden="true">↓</span></a>
      </div>
    </div>
    <div class="workflow-art">
      <div class="art-header">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Feedback workflow</span>
      </div>
      <div class="art-board">
        <div class="art-step"><span class="step-symbol" aria-hidden="true">↳</span><div><strong>Collect</strong><p>Feedback boards and embedded forms</p></div></div>
        <span class="art-connector" aria-hidden="true"></span>
        <div class="art-step art-middle"><span class="step-symbol" aria-hidden="true">↑</span><div><strong>Prioritize</strong><p>Votes, discussions, and statuses</p></div></div>
        <span class="art-connector" aria-hidden="true"></span>
        <div class="art-step"><span class="step-symbol" aria-hidden="true">↗</span><div><strong>Publish</strong><p>Roadmaps and changelogs</p></div></div>
      </div>
    </div>
  </section>

  <section id="features" class="feature-section">
    <div class="site-width feature-inner">
      <h2>Bring customer feedback into your product planning.</h2>
      <div class="feature-grid">
        {#each features as feature (feature.name)}
          <article>
            <span class="feature-mark" aria-hidden="true">{feature.mark}</span>
            <h3>{feature.name}</h3>
            <p>{feature.detail}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section id="workflow" class="site-width workflow-section">
    <div>
      <h2>From a customer request to a release note.</h2>
      <p>Decide what to share at each step. Your team can review submissions privately and publish the work customers should see.</p>
    </div>
    <ol>
      <li><strong>Capture the request</strong><p>Use a workspace board or embed the form on your site.</p></li>
      <li><strong>Review and prioritize</strong><p>Group requests by product, discuss them, and update their status.</p></li>
      <li><strong>Close the loop</strong><p>Publish a roadmap entry and share the release when it ships.</p></li>
    </ol>
  </section>

  <section id="questions" class="questions-section">
    <div class="site-width questions-inner">
      <h2>Frequently asked questions</h2>
      <div>
        {#each questions as question (question.question)}
          <details>
            <summary>{question.question}</summary>
            <p>{question.answer}</p>
          </details>
        {/each}
      </div>
    </div>
  </section>

  <section class="site-width landing-cta">
    <h2>Make room for your customers’ ideas.</h2>
    <a class="button" href="/auth/register">Create your workspace <span aria-hidden="true">↗</span></a>
  </section>
</div>

<style>
  .landing-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: clamp(2rem, 6vw, 6rem); align-items: center; padding-block: clamp(3rem, 9vw, 8rem); }
  .eyebrow { display: flex; align-items: center; gap: 0.65rem; color: var(--accent); font-weight: 700; font-size: 0.86rem; margin-bottom: 1.25rem; }
  .eyebrow span { width: 0.7rem; aspect-ratio: 1; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  h1 { font-size: clamp(3.2rem, 6.65vw, 6.6rem); max-width: 12ch; letter-spacing: -0.065em; overflow-wrap: anywhere; }
  .hero-description { font-size: clamp(1.05rem, 1.7vw, 1.25rem); line-height: 1.65; color: var(--muted); max-width: 44ch; margin-block: 1.4rem 1.75rem; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .workflow-art { background: var(--ink); color: #fff7ec; border-radius: 1.3rem; padding: clamp(1rem, 3vw, 2rem); box-shadow: 12px 12px 0 #e8dbdf; }
  .art-header { display: flex; align-items: center; gap: 0.65rem; padding-bottom: 1.2rem; border-bottom: 1px solid #735766; font-weight: 650; }
  .art-header .brand-mark { background: #f8e1eb; color: #42273a; }
  .art-board { display: grid; padding-block: 1.2rem 0.15rem; }
  .art-step { display: flex; align-items: center; gap: 0.85rem; background: #493341; border: 1px solid #735766; border-radius: 0.7rem; padding: 0.9rem; }
  .art-step strong { font-size: 1.05rem; }
  .art-step p { color: #efdae5; font-size: 0.85rem; }
  .step-symbol { display: grid; place-items: center; flex: 0 0 2.35rem; height: 2.35rem; border-radius: 0.5rem; font-size: 1.2rem; background: #f2ded0; color: #45263d; }
  .art-middle { margin-inline-start: clamp(0.4rem, 3vw, 2rem); background: #593e55; }
  .art-connector { height: 1.1rem; width: 1px; background: #977587; margin-left: 2.2rem; }
  h2 { font: 500 clamp(2.2rem, 4vw, 4rem)/1.04 var(--display); letter-spacing: -0.05em; text-wrap: balance; }
  .feature-section { background: #f3e9e5; border-block: 1px solid var(--line); }
  .feature-inner, .workflow-section, .questions-inner { padding-block: clamp(2.75rem, 7vw, 6.5rem); }
  .feature-inner h2 { max-width: 17ch; }
  .feature-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 2rem; border-block: 1px solid #cfbdc4; }
  .feature-grid article { padding: 1.5rem 1rem; }
  .feature-grid article + article { border-inline-start: 1px solid #cfbdc4; }
  .feature-mark { display: inline-grid; place-items: center; color: var(--accent); border: 1px solid #c8aebb; background: #fffaf6; width: 2.4rem; height: 2.4rem; border-radius: 0.65rem; margin-bottom: 1rem; font-weight: 750; }
  h3 { font-size: 1rem; font-weight: 750; margin-bottom: 0.45rem; }
  .feature-grid p, .workflow-section p, .questions-inner p { color: var(--muted); line-height: 1.6; }
  .workflow-section, .questions-inner { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(1.5rem, 7vw, 7rem); }
  .workflow-section p { margin-top: 0.7rem; max-width: 42ch; }
  .workflow-section ol { list-style-type: decimal; padding-inline-start: 2rem; }
  .workflow-section li { padding: 0.85rem 0; border-bottom: 1px solid var(--line); }
  .workflow-section li::marker { font-weight: 750; color: var(--accent); }
  .workflow-section li p { margin-top: 0.25rem; }
  .questions-section { border-block: 1px solid var(--line); background: #fffaf4; }
  .questions-inner details { padding-block: 0.8rem; border-bottom: 1px solid var(--line); }
  .questions-inner summary { min-height: 44px; cursor: pointer; font-weight: 700; }
  .landing-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem; padding-block: clamp(2.7rem, 6vw, 5.5rem); }
  .landing-cta h2 { max-width: 22ch; }
  @media (max-width: 55rem) {
    .feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .feature-grid article:nth-child(3) { border-inline-start: 0; }
    .feature-grid article:nth-child(n+3) { border-top: 1px solid #cfbdc4; }
  }
  @media (max-width: 43rem) {
    .landing-hero, .workflow-section, .questions-inner { grid-template-columns: minmax(0, 1fr); }
    .workflow-art { box-shadow: 6px 6px 0 #e8dbdf; }
  }
  @media (max-width: 27rem) {
    .feature-grid { grid-template-columns: minmax(0, 1fr); }
    .feature-grid article + article { border-inline-start: 0; border-top: 1px solid #cfbdc4; }
  }
</style>
