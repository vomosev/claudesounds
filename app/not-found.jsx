import Button from '../components/ui/Button';

export const metadata = {
  title: 'Page not found — ClaudeSounds',
  description: 'The page you were looking for is not part of the ClaudeSounds catalogue.',
};

export default function NotFound() {
  return (
    <section className="stack section-narrow">
      <p className="eyebrow">Error 404</p>
      <h1>That track isn&apos;t in our catalogue</h1>
      <p className="prose">
        We couldn&apos;t find the page you asked for. It may have been taken down, renamed, or the
        link that brought you here might be missing a character. Your releases, publishing works and
        campaigns are all still safe in your account.
      </p>
      <div className="cluster">
        <Button as="link" href="/" variant="primary" size="md">
          Back to home
        </Button>
        <Button as="link" href="/releases" variant="secondary" size="md">
          Browse your releases
        </Button>
      </div>
    </section>
  );
}