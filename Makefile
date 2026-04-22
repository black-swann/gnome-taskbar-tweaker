UUID := $(shell node -p "require('./metadata.json').uuid")
EXTENSION_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
LOCAL_SCHEMA_DIR := $(HOME)/.local/share/glib-2.0/schemas
SCHEMA_FILE := schemas/org.gnome.shell.extensions.gnome-taskbar-tweaker.gschema.xml
DIST_DIR := dist
METADATA_FILE := metadata.json
VERSION := $(shell node -p "require('./$(METADATA_FILE)').version")
RELEASE_NAME := gnome-taskbar-tweaker-v$(VERSION)
PACKED_ZIP := $(DIST_DIR)/$(UUID).shell-extension.zip
RELEASE_ZIP := $(DIST_DIR)/$(RELEASE_NAME).zip

.PHONY: schemas lint check install uninstall package install-package release clean-dist

schemas:
	glib-compile-schemas schemas

lint:
	node --check extension.js
	node --check prefs.js
	node --check layout.js

check: schemas lint

install: schemas
	mkdir -p "$(EXTENSION_DIR)"
	rsync -a --delete \
		--exclude '.git' \
		--exclude 'dist' \
		--exclude '.DS_Store' \
		--exclude 'schemas/gschemas.compiled' \
		./ "$(EXTENSION_DIR)/"
	glib-compile-schemas "$(EXTENSION_DIR)/schemas"
	mkdir -p "$(LOCAL_SCHEMA_DIR)"
	cp "$(SCHEMA_FILE)" "$(LOCAL_SCHEMA_DIR)/"
	glib-compile-schemas "$(LOCAL_SCHEMA_DIR)"

uninstall:
	rm -rf "$(EXTENSION_DIR)"
	rm -f "$(LOCAL_SCHEMA_DIR)/$(notdir $(SCHEMA_FILE))"
	glib-compile-schemas "$(LOCAL_SCHEMA_DIR)"

package: check clean-dist
	mkdir -p "$(DIST_DIR)"
	gnome-extensions pack . \
		--force \
		--out-dir "$(DIST_DIR)" \
		--schema="$(SCHEMA_FILE)" \
		--extra-source=layout.js
	cp "$(PACKED_ZIP)" "$(RELEASE_ZIP)"

install-package: package
	gnome-extensions install --force "$(RELEASE_ZIP)"

release: package
	@printf '%s\n' "$(RELEASE_ZIP)"

clean-dist:
	rm -rf "$(DIST_DIR)"
