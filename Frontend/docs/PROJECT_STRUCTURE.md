# PublicLab Frontend — Project Structure

The project structure strictly adheres to the requested directory tree without arbitrary folders or duplicate files.

```text
Frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── Features/
│   │   ├── User/
│   │   │   ├── Component/
│   │   │   │   ├── Navbar/            # Desktop & mobile responsive navigation
│   │   │   │   ├── Footer/            # Platform description & legal links
│   │   │   │   ├── Hero/              # Headline, city search, trust badges
│   │   │   │   ├── QuickActions/      # 4 interactive navigation cards
│   │   │   │   ├── HowItWorks/        # 4-step progressive timeline
│   │   │   │   ├── LabCard/           # Verified facility card
│   │   │   │   ├── TestCard/          # Test panel presentation
│   │   │   │   ├── ReportSection/     # Passwordless OTP report access box
│   │   │   │   ├── PatientStories/    # Editorial experience scenarios
│   │   │   │   ├── CustomerReviews/   # Dual-row horizontal animated marquee
│   │   │   │   ├── ImpactSection/     # Clinical architecture cards
│   │   │   │   ├── CallbackForm/      # Validated callback request form
│   │   │   │   ├── CtaBanner/         # Final action banner
│   │   │   │   └── UserLayout.jsx     # Master public portal shell
│   │   │   ├── Pages/
│   │   │   │   ├── Home/              # Landing page uniting 12 sections
│   │   │   │   ├── LabSearch/         # Directory search & city pills
│   │   │   │   ├── LabDetails/        # Facility profile & inline inquiry
│   │   │   │   ├── TestPackages/      # Categorized test packages
│   │   │   │   ├── Reports/           # Dedicated passwordless report portal
│   │   │   │   ├── Callback/          # Callback inquiry page
│   │   │   │   └── NotFound/          # 404 page
│   │   │   ├── hooks/                 # useLabSearch, useReportAccess, useCallbackRequest
│   │   │   ├── state/                 # user.context.jsx
│   │   │   └── services/              # lab.service.js, report.service.js, callback.service.js, test.service.js
│   │   │
│   │   ├── Lab/
│   │   │   ├── Component/
│   │   │   │   └── LabLayout.jsx      # Sidebar & header shell for lab owners
│   │   │   ├── Pages/
│   │   │   │   ├── Dashboard/         # Operational metrics
│   │   │   │   ├── Patients/          # Patient directory & registration modal
│   │   │   │   ├── Orders/            # Diagnostic orders & status transitions
│   │   │   │   ├── Reports/           # Draft upload, publishing, correction
│   │   │   │   ├── Subscription/      # Plan selection & active status
│   │   │   │   └── Settings/          # Lab profile & operational settings
│   │   │   ├── state/                 # lab.context.jsx
│   │   │   └── services/              # lab.service.js
│   │   │
│   │   ├── Admin/
│   │   │   ├── Component/
│   │   │   │   └── AdminLayout.jsx    # Dark slate governance console shell
│   │   │   ├── Pages/
│   │   │   │   ├── Dashboard/         # National oversight metrics
│   │   │   │   ├── LabApprovals/      # Accreditation review queue
│   │   │   │   ├── Laboratories/      # Registered facilities & suspension
│   │   │   │   ├── Users/             # Platform accounts management
│   │   │   │   └── Subscriptions/     # Plan oversight
│   │   │   ├── state/                 # admin.context.jsx
│   │   │   └── services/              # admin.service.js
│   │   │
│   │   └── Auth/
│   │       ├── Pages/
│   │       │   ├── LabLogin/          # Lab owner login & unified registration
│   │       │   └── AdminLogin/        # Fixed admin credentials login
│   │       ├── state/                 # auth.context.jsx
│   │       └── services/              # auth.service.js
│   │
│   ├── Core/
│   │   ├── config/                    # env.js
│   │   └── http/                      # api.client.js, interceptors.js
│   │
│   ├── Shared/
│   │   └── Component/
│   │       ├── Button/                # Variants: primary, secondary, outline, ghost, danger
│   │       ├── Input/                 # forwardRef, prefix/suffix icons, error text
│   │       ├── Modal/                 # ARIA accessible, scroll lock, Esc key
│   │       ├── Loader/                # Animated spinner & fullscreen overlay
│   │       ├── Badge/                 # Status tags
│   │       └── Skeleton/              # Shimmer loader
│   │
│   ├── styles/
│   │   ├── abstracts/                 # _variables.scss, _mixins.scss, _breakpoints.scss
│   │   ├── base/                      # _reset.scss, _typography.scss, _global.scss
│   │   ├── themes/                    # _tokens.scss
│   │   ├── components/                # _animations.scss
│   │   └── main.scss                  # Central stylesheet entry
│   │
│   ├── test/                          # setup.js, api.test.jsx, workflows.test.jsx
│   ├── App.jsx                        # Context provider composition
│   ├── app.routes.jsx                 # Single routing definition file
│   └── main.jsx                       # ReactDOM entry point
│
├── docs/                              # Comprehensive frontend technical docs
├── .env
├── .env.example
├── package.json
├── vite.config.js
└── README.md
```
