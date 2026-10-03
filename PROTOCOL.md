# Evaluation protocol v1

## Objective

Select a candidate only within the set satisfying declared content, role bindings,
canvas, type size, solid-background contrast, visibility, and color constraints.
Within that set, require consistent independent pairwise preference in both image orders,
adequate absolute design quality for the slide role, and grounded reading answers.
There is no arbitrary weighted beauty score and no learned preference probability in v1.
No outcome in v1 constitutes user acceptance or permission to expand a presentation.

## Existing-renderer integration

The adapter reads `measurement.json`, `native-model.json`, and `<slide>.png` from an
existing renderer snapshot. A new capture includes `visibilityVersion: "dom-v1"`,
each text node's ancestor-aware `visible` boolean, and an `imageHashes` map keyed by slide number.
Older captures remain readable but return unknown for unmeasured visibility.
PNG decoding, dimensions, revision consistency, image digests, and frozen packet images are checked.
Capture changes invalidate an in-progress review.

```sh
npm run build
node dist/src/cli.js gate --snapshot /path/to/capture --contract /path/to/contract.json --out /path/to/new-gate.json
node dist/src/cli.js prepare --baseline /path/to/baseline --candidate /path/to/candidate --contract /path/to/contract.json --out /path/to/new-session
node dist/src/cli.js evaluate --session /path/to/session --review /path/to/first-review.json --review /path/to/second-review.json --feedback /path/to/human-feedback.json --out /path/to/new-result.json --attempt 1 --budget 3
```

Output paths must be new. No silent overwrites. Exit 1 is an input/execution error;
gate exit 2 is a failed requirement, exit 3 is unknown/held. Evaluation exit 0 means
proposed for human review, not aesthetic approval. These commands never modify HTML/Figma/PPT.
The caller supplies the current attempt within one feedback episode; this is a bounded
decision policy, not a background generation service or a tamper-proof resource quota.

## Reviewer boundary

Give each fresh reviewer only one `pass-N` folder, including its two images, task,
instructions and JSON schema. Keep `session.private.json`, prior user feedback, original
version names, and the other pass away from reviewers. A second fresh context receives
the reverse order. Use different reviewer IDs; record independence and actual provenance.
The JSON-file adapter accepts reviews from an authorized independent agent, an API adapter,
or the current host. It does not itself spawn agents, buy API usage, or prove who wrote a file.
Host review is explicitly non-independent and cannot promote a candidate.
No external model adapter/API call is included in v1; the orchestrating environment supplies
authorized reviewer responses. Missing responses remain held rather than mocked as real evidence.

## Calibration and failure behavior

- Preserve exact image digests and explicit human feedback. Pending is not positive.
- Report false acceptance on human-rejected cases, false rejection on human-accepted cases,
  and coverage together. Missing denominators are null, never zero-percent error.
- Exclude host self-judgments from independent calibration statistics.
- The first collection is descriptive. Calibration requires held-out examples grouped by
  slide/content family; near-identical revisions must not appear on both sides of a split.
- A high relative preference cannot compensate for missing content or inadequate absolute quality.
- Missing, invalid, stale, order-sensitive, or abstained judgments do not auto-pass.
- Same-render comparisons are not new design iterations. After the iteration budget, stop.
- Test authored defects with real rendering as well as unit tests. Synthetic outcomes verify
  program behavior, not a model's visual taste or agreement with people.

## Practical limits

Bounds checks inspect text allocation boxes, not every possible visual overlap. Contrast
uses explicit solid-background surfaces at the text-box center; images, gradients, masking,
partial transparency, and mixed backgrounds require visual review. Token preservation does
not prove relationship meaning. Exact role bindings catch declared local label substitutions;
they do not prove that an arbitrary connector points to the right actor. Reading checks also
require image review. Familiar content may leak prior knowledge; use anonymized unfamiliar
examples before claiming comprehension accuracy. Neither font pixels nor a fixed contrast
ratio alone prove auditorium readability. Thresholds belong to the declared presentation role.

## Research pointers

- [Position bias in LLM judges](https://arxiv.org/abs/2406.07791): motivates swapped-order checks;
  text-evaluation findings are not a measured error rate for this slide evaluator.
- [UICrit](https://github.com/google-research-datasets/uicrit): location-grounded critique;
  mobile UI labels are not PPT preference ground truth.
- [PPTAgent v0.2.0 style rubric](https://raw.githubusercontent.com/icip-cas/PPTAgent/v0.2.0/pptagent/prompts/ppteval/ppteval_style.txt):
  an example of decoration/color assumptions deliberately not used in this evaluator.
