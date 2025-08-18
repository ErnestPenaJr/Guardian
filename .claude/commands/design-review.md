# Design Review Slash Command

## Command: `/design-review`

### Purpose
Triggers a comprehensive design review of recent frontend changes using the design-review agent with live Playwright testing.

### Usage
```
/design-review [optional: specific component or page]
```

### Examples
```
/design-review
/design-review RequestModal
/design-review dashboard
/design-review forms/new-request
```

### Implementation

When `/design-review` is invoked, the system should:

1. **Identify Changes**: Determine what frontend files have been modified recently
2. **Launch Design Review Agent**: Activate the specialized design-review agent
3. **Live Testing**: Use Playwright to navigate and test the application
4. **Comprehensive Analysis**: Follow the 7-phase review methodology
5. **Generate Report**: Provide actionable feedback with screenshots and specific recommendations

### Agent Integration

```markdown
I'll conduct a comprehensive design review using our specialized design-review agent with live Playwright testing.

Let me use the design-review agent to systematically evaluate the UI changes.
```

### Review Process

The agent will automatically:

#### Phase 1: Preparation
- Identify modified components from git diff
- Review design principles and acceptance criteria
- Set up testing environment (1440px viewport)

#### Phase 2: Interaction Testing
```javascript
// Navigate to affected pages
await page.goto('http://localhost:5175/dashboard');
await page.screenshot({ path: 'review-dashboard.png' });

// Test interactive elements
await page.click('[data-testid="request-button"]');
await page.screenshot({ path: 'review-modal-interaction.png' });
```

#### Phase 3: Responsiveness
```javascript
// Test multiple viewports
const viewports = [
  { width: 375, height: 667 },   // Mobile
  { width: 768, height: 1024 },  // Tablet
  { width: 1440, height: 900 }   // Desktop
];

for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  await page.screenshot({ path: `review-${viewport.width}x${viewport.height}.png` });
}
```

#### Phase 4: Visual Polish
- Typography hierarchy assessment
- Color contrast validation
- Spacing and alignment verification
- Brand consistency check

#### Phase 5: Accessibility
```javascript
// Check for accessibility violations
const violations = await page.evaluate(() => {
  return axe.run();
});

// Test keyboard navigation
await page.keyboard.press('Tab');
await page.screenshot({ path: 'review-keyboard-navigation.png' });
```

#### Phase 6: Robustness
- Error state testing
- Edge case scenarios
- Performance impact assessment

#### Phase 7: Code Health
- Component structure review
- CSS organization assessment
- Performance considerations

### Report Format

The design review will generate a comprehensive report including:

```markdown
## Design Review Report

### Executive Summary
- Overall assessment: [Excellent/Good/Needs Improvement/Critical Issues]
- Key findings: [3-5 bullet points]
- Priority actions: [Immediate fixes needed]

### Detailed Findings

#### Critical Issues (Must Fix Before Deploy)
- [Issue description with screenshot evidence]
- **Impact**: [User experience/accessibility/security concern]
- **Resolution**: [Specific steps to fix]

#### High Priority (Should Fix)
- [Design system inconsistencies]
- **Evidence**: [Screenshots or specific examples]
- **Recommendation**: [Suggested improvements]

#### Medium Priority (Nice to Fix)
- [Polish improvements]
- **Context**: [Why this matters]
- **Suggestion**: [How to improve]

### Screenshots
![Dashboard View](review-dashboard.png)
![Mobile Responsive](review-375x667.png)
![Interaction States](review-modal-interaction.png)

### Accessibility Report
- WCAG 2.1 AA Compliance: [Pass/Fail with specific violations]
- Keyboard Navigation: [Assessment]
- Screen Reader Compatibility: [Status]

### Performance Impact
- Load Time Impact: [Measurement]
- Interaction Responsiveness: [Assessment]
- Bundle Size Changes: [If applicable]

### Code Quality
- Component Structure: [Assessment]
- CSS Organization: [Feedback]
- Reusability: [Recommendations]

### Next Steps
1. [Prioritized action items]
2. [Suggested improvements]
3. [Follow-up testing needed]
```

### Integration Points

#### Git Integration
```bash
# Automatically detect recent changes
git diff --name-only HEAD~1 HEAD | grep -E '\.(tsx?|css|scss)$'
```

#### Playwright Integration
```javascript
// Standard setup for design reviews
await page.goto('http://localhost:5175');
await page.waitForLoadState('networkidle');
await page.setViewportSize({ width: 1440, height: 900 });
```

#### Design Principles Reference
- Automatically cross-reference findings against `/docs/design-principles.md`
- Ensure compliance with Guardian MVP standards
- Check accessibility requirements

### Triggering Conditions

Auto-trigger design review when:
- Pull request includes frontend file changes
- New components are added
- Major UI modifications are detected
- Accessibility-critical changes are made

Manual trigger via:
- `/design-review` slash command
- Pre-deployment checklist
- Feature completion validation

### Prerequisites

Before running design review:
1. Development server running (`bun run dev`)
2. Recent changes committed to git
3. Playwright browser installed and configured
4. Design principles document available

### Configuration

Set up environment variables if needed:
```bash
DESIGN_REVIEW_URL=http://localhost:5175
DESIGN_REVIEW_VIEWPORT_WIDTH=1440
DESIGN_REVIEW_VIEWPORT_HEIGHT=900
```

### Success Criteria

A successful design review should:
- ✅ Complete all 7 phases without errors
- ✅ Generate actionable, specific feedback
- ✅ Include visual evidence (screenshots)
- ✅ Prioritize issues appropriately
- ✅ Reference design principles
- ✅ Provide clear next steps