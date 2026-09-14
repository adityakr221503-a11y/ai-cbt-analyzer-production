# RankForge Unified Question Bank

- Core/master bank is the primary test source.
- AI-generated candidates remain in `rankerAiApprovedQuestionsV1` and are joined only at test-generation time.
- Reference PDFs/DPPs are calibration/reference material, not silently imported as the master bank.
- AI candidates require structural/quality validation before entering the separate AI bank.
- No manual question-creation workflow is added.
- Secure generation stays server-side; browser code must never contain an API key.
