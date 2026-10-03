# Implementation boundaries

Keep the existing rendering pipeline. This package only evaluates captured artifacts.
Domain must not import filesystem, network, adapters, or application code.
Application may import domain; adapters may import domain and application. No barrels.
Use schema validation at input boundaries; never swallow parse or transport errors.
Test observable decisions, malformed inputs, swapped presentation order, stale hashes,
missing content, failed renders, and identical candidates. Mock external boundaries only.
Run `npm run check` before release. Keep private presentations and local configuration outside Git.
Human acceptance must only come from explicit human feedback. Unknown is never accepted.
