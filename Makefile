# ---------------------------------------------------------------------------- #
#     Uno Browser Extension                                                    #
# ---------------------------------------------------------------------------- #

.PHONY: local, watch, debug, prod, ff-review \
    internal, release \
    deps, package-lock.json \
		test, e2e, e2e.ui, e2e.report \
		typecheck, lint, format \
		clean, clobber \
		docbuild, FRC

# Disable builtin rules since we're not building C[XX]
MAKEFLAGS += --no-builtin-rules
.SUFFIXES:

# ---------------------
# Makefile config vars:

export OUTDIR ?= dist

# --------------------
# Convenience targets:

# Local Build (localhost:8080)
local: deps
local:
	npm run build.local

# Development Server (api.u10.dev; w/hot-reloading build server)
watch: deps
watch:
	npm run watch.dev

# Development Build (api.u10.dev; w/o hot-reloading build server)
.DEFAULT_GOAL := debug
debug: deps
debug:
	npm run build.dev

# Production Build (api.uno.app; w/o executing release workflows)
prod: deps
prod:
	npm run build.prod

# Production Build for Firefox Reviewers (api.uno.app; w/o executing release workflows)
ff-review: deps
ff-review:
	npm run build.ff-review

# --------------------
# Deliverable targets:
# (in use by our native iOS build system)

# Internal Production Release (api.u10.dev)
internal: deps
internal:
	npm run build.internal

# External Production Release (api.uno.app)
release: deps
release:
	npm run build.release

# -----------------
# Dependency rules:

deps: package-lock.json

package-lock.json: .package-lock.timestamp

.package-lock.timestamp: package.json ./cli/package.json
	npm install
	touch .package-lock.timestamp

# --------
# Testing:

test: FRC
	npm run test

e2e: FRC
	npm run e2e

e2e.ui: FRC
	npm run e2e.ui

e2e.report: FRC
	npm run e2e.report

# -------
# Checks:

typecheck: FRC
	npm run typecheck

lint: FRC
	npm run lint

format: FRC
	npm run format

# ----------------
# Other utilities:

clean: FRC
	npm run clean

clobber: FRC
	npm run clobber

docbuild:
	@echo "THIS PRODUCT DOES NOT HAVE DOCUMENTATION."

# Force Re-Compile
# -     -  -
FRC:
