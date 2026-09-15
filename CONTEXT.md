# Verification Cost

Spotter concerns the cost of obtaining sufficient, trustworthy evidence in LLM-assisted development.

## Language

**Verification complexity**:
The test code, supporting mechanisms, and execution decisions needed to establish whether a change satisfies its claims. It includes tests, fakes, fixtures, helpers, evidence artifacts, and repeated runs.
_Avoid_: Total application code size

**Verification cost**:
The creation and maintenance effort, execution time, and model context consumed by verification. Line count and test count are partial measurements, not definitions of success.
_Avoid_: Lines saved, token savings as the sole outcome

**Claim**:
A specific behavior or explicit structural contract that evidence must establish, grounded in a requirement, public contract, or invariant.
_Avoid_: A test name as proof

**Fault boundary**:
An independently failing part of a claim, such as a pure rule, a consumer workflow, or a platform interaction. Evidence at one boundary need not establish correctness at another.
_Avoid_: File boundary, coverage percentage

**Primary evidence**:
The cheapest sufficient observation or check for a claim at a particular fault boundary. Sufficiency includes preserving independent risk coverage, not merely reducing the number of tests.
_Avoid_: More tests, a recorded PASS without its supporting evidence
