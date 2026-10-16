# React rendering layer

Markdown remains the source of content. React components own presentation and interaction.

Top-level page components are `QuizQuestion`, `QuizExplanation`, `Lab`, and `LabSolution`.

Reusable components include `Navigation` (derived from Markdown headings), `CodeBlock`, `MermaidDiagram`, `TextField`, and `Drawing` (Excalidraw).

The Jekyll page still renders Markdown to semantic HTML first. React progressively enhances that output, so prose, code, headings, and diagram/drawing source stay in Markdown rather than JSX.
