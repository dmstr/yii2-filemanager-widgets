<script setup lang="ts">
/**
 * Top bar: breadcrumb, refresh, search dropdown, the three view switch
 * buttons and the "more" dropdown. Port of the AngularJS navbar without
 * Bootstrap's JavaScript; the dropdowns open and close in Vue.
 */
import { useConfig } from '../config/injection.ts';
import { useI18n } from '../i18n/index.ts';
import { useFileManager } from '../services/fileManager.ts';
import Breadcrumb from './Breadcrumb.vue';
import { textModel, vTextModel } from './modelTrim.ts';
import { useDropdown } from './useDropdown.ts';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

// ng-model with the default ngTrim, like the AngularJS search field: the query is the trimmed text.
const query = textModel(
  () => fm.query,
  (value) => {
    fm.query = value;
  },
);

// Template refs are bound by variable name (`ref="searchRoot"`), so the two instances are destructured.
const {
  root: searchRoot,
  toggle: searchToggle,
  open: searchOpen,
  expanded: searchExpanded,
  onToggleClick: onSearchToggle,
  onKeydown: onSearchKeydown,
} = useDropdown();
const {
  root: moreRoot,
  toggle: moreToggle,
  open: moreOpen,
  expanded: moreExpanded,
  onToggleClick: onMoreToggle,
  onKeydown: onMoreKeydown,
} = useDropdown();
</script>

<template>
  <nav class="navbar navbar-inverse">
    <div class="container-fluid">
      <div class="row">
        <div class="col-xs-12 col-sm-8 col-md-9 ">
          <div v-show="config.breadcrumb">
            <Breadcrumb :navigator="fm.navigator" />
          </div>
        </div>
        <div class="col-xs-12 col-sm-4 col-md-3">
          <div class="navbar-collapse">
            <div class="navbar-form navbar-right text-right">

              <button class="btn btn-flat btn-sm" :title="t('refresh')" @click="fm.refreshLocation(true)">
                <i class="glyphicon glyphicon-refresh"></i>
              </button>

              <div v-show="config.searchForm" ref="searchRoot" class="btn-group" :class="{ open: searchOpen }">
                <button
                  id="dropDownMenuLang"
                  ref="searchToggle"
                  class="btn btn-flat btn-sm dropdown-toggle"
                  type="button"
                  :aria-expanded="searchExpanded"
                  @click="onSearchToggle"
                  @keydown="onSearchKeydown"
                >
                  <i class="glyphicon glyphicon-search mr2"></i>
                </button>
                <div class="dropdown-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="dropDownMenuLang" @keydown="onSearchKeydown">
                  <input v-text-model="query" type="text" class="form-control" :placeholder="t('search') + '...'" />
                </div>
              </div>

              <button
                v-show="
                  (fm.viewTemplate === 'main-icons-preview.html' && config.enableIconPreviewView) ||
                  (fm.viewTemplate === 'main-table.html' && !config.enableIconPreviewView)
                "
                class="btn btn-flat btn-sm fm-icons"
                :title="t('switch_to_icons_view')"
                @click="fm.setTemplate('main-icons.html')"
              >

                <i class="glyphicon glyphicon-th-large"></i>
              </button>

              <button
                v-show="fm.viewTemplate === 'main-icons.html'"
                class="btn btn-flat btn-sm fm-table"
                :title="t('switch_to_table_view')"
                @click="fm.setTemplate('main-table.html')"
              >

                <i class="glyphicon glyphicon-th-list"></i>
              </button>

              <button
                v-if="config.enableIconPreviewView"
                v-show="fm.viewTemplate === 'main-table.html' && config.enableIconPreviewView"
                class="btn btn-flat btn-sm fm-preview"
                :title="t('switch_to_preview_view')"
                @click="fm.setTemplate('main-icons-preview.html')"
              >

                <i class="glyphicon glyphicon-picture"></i>
              </button>

              <div
                v-show="config.allowedActions.createFolder || config.allowedActions.upload"
                ref="moreRoot"
                class="btn-group"
                :class="{ open: moreOpen }"
              >
                <button
                  id="more"
                  ref="moreToggle"
                  class="btn btn-flat btn-sm dropdown-toggle"
                  type="button"
                  :aria-expanded="moreExpanded"
                  @click="onMoreToggle"
                  @keydown="onMoreKeydown"
                >
                  <i class="glyphicon glyphicon-option-vertical"></i>
                </button>

                <!-- The links keep href="#" as in the AngularJS markup; .prevent matches the AngularJS behaviour, where the $location click handler cancelled the navigation (no hash change, no scrolling). -->
                <ul class="dropdown-menu scrollable-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="more" @keydown="onMoreKeydown">
                  <li v-show="config.allowedActions.createFolder" role="presentation" @click="fm.modal('newfolder') && fm.prepareNewFolder()">
                    <a href="#" role="menuitem" tabindex="-1" @click.prevent>
                      <i class="glyphicon glyphicon-plus"></i> {{ t('new_folder') }}
                    </a>
                  </li>
                  <li v-show="config.allowedActions.upload" role="presentation" @click="fm.modal('uploadfile')">
                    <a href="#" role="menuitem" tabindex="-1" @click.prevent>
                      <i class="glyphicon glyphicon-cloud-upload"></i> {{ t('upload_files') }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>
