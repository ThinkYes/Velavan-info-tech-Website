/**
 * Bootstrap Multiselect (https://github.com/davidstutz/bootstrap-multiselect)
 * 
 * Apache License, Version 2.0:
 * Copyright (c) 2012 - 2015 David Stutz
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a
 * copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 * 
 * BSD 3-Clause License:
 * Copyright (c) 2012 - 2015 David Stutz
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    - Redistributions of source code must retain the above copyright notice,
 *      this list of conditions and the following disclaimer.
 *    - Redistributions in binary form must reproduce the above copyright notice,
 *      this list of conditions and the following disclaimer in the documentation
 *      and/or other materials provided with the distribution.
 *    - Neither the name of David Stutz nor the names of its contributors may be
 *      used to endorse or promote products derived from this software without
 *      specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
!function ($) {
    "use strict";
    // jshint ;_;

    if (typeof ko !== 'undefined' && ko.bindingHandlers && !ko.bindingHandlers.multiselect) {
        ko.bindingHandlers.multiselect = {
            after: ['options', 'value', 'selectedOptions', 'enable', 'disable'],

            init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                var $element = $(element);
                var config = ko.toJS(valueAccessor());

                $element.multiselect(config);

                if (allBindings.has('options')) {
                    var options = allBindings.get('options');
                    if (ko.isObservable(options)) {
                        ko.computed({
                            read: function () {
                                options();
                                setTimeout(function () {
                                    var ms = $element.data('multiselect');
                                    if (ms)
                                        ms.updateOriginalOptions();
                                    //Not sure how beneficial this is.
                                    $element.multiselect('rebuild');
                                }
                                , 1);
                            },
                            disposeWhenNodeIsRemoved: element
                        });
                    }
                }

                //value and selectedOptions are two-way, so these will be triggered even by our own actions.
                //It needs some way to tell if they are triggered because of us or because of outside change.
                //It doesn't loop but it's a waste of processing.
                if (allBindings.has('value')) {
                    var value = allBindings.get('value');
                    if (ko.isObservable(value)) {
                        ko.computed({
                            read: function () {
                                value();
                                setTimeout(function () {
                                    $element.multiselect('refresh');
                                }
                                , 1);
                            },
                            disposeWhenNodeIsRemoved: element
                        }).extend({
                            rateLimit: 100,
                            notifyWhenChangesStop: true
                        });
                    }
                }

                //Switched from arrayChange subscription to general subscription using 'refresh'.
                //Not sure performance is any better using 'select' and 'deselect'.
                if (allBindings.has('selectedOptions')) {
                    var selectedOptions = allBindings.get('selectedOptions');
                    if (ko.isObservable(selectedOptions)) {
                        ko.computed({
                            read: function () {
                                selectedOptions();
                                setTimeout(function () {
                                    $element.multiselect('refresh');
                                }
                                , 1);
                            },
                            disposeWhenNodeIsRemoved: element
                        }).extend({
                            rateLimit: 100,
                            notifyWhenChangesStop: true
                        });
                    }
                }

                var setEnabled = function (enable) {
                    setTimeout(function () {
                        if (enable)
                            $element.multiselect('enable');
                        else
                            $element.multiselect('disable');
                    }
                    );
                }
                ;

                if (allBindings.has('enable')) {
                    var enable = allBindings.get('enable');
                    if (ko.isObservable(enable)) {
                        ko.computed({
                            read: function () {
                                setEnabled(enable());
                            },
                            disposeWhenNodeIsRemoved: element
                        }).extend({
                            rateLimit: 100,
                            notifyWhenChangesStop: true
                        });
                    } else {
                        setEnabled(enable);
                    }
                }

                if (allBindings.has('disable')) {
                    var disable = allBindings.get('disable');
                    if (ko.isObservable(disable)) {
                        ko.computed({
                            read: function () {
                                setEnabled(!disable());
                            },
                            disposeWhenNodeIsRemoved: element
                        }).extend({
                            rateLimit: 100,
                            notifyWhenChangesStop: true
                        });
                    } else {
                        setEnabled(!disable);
                    }
                }

                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    $element.multiselect('destroy');
                }
                );
            },

            update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                var $element = $(element);
                var config = ko.toJS(valueAccessor());

                $element.multiselect('setOptions', config);
                $element.multiselect('rebuild');
            }
        };
    }

    function forEach(array, callback) {
        for (var index = 0; index < array.length; ++index) {
            callback(array[index], index);
        }
    }

    /**
     * Constructor to create a new multiselect using the given select.
     *
     * @param {jQuery} select
     * @param {Object} options
     * @returns {Multiselect}
     */
    function Multiselect(select, options) {

        this.$select = $(select);

        // Placeholder via data attributes
        if (this.$select.attr("data-placeholder")) {
            options.nonSelectedText = this.$select.data("placeholder");
        }

        this.options = this.mergeOptions($.extend({}, options, this.$select.data()));

        // Initialization.
        // We have to clone to create a new reference.
        this.originalOptions = this.$select.clone()[0].options;
        this.query = '';
        this.searchTimeout = null;
        this.lastToggledInput = null;

        this.options.multiple = this.$select.attr('multiple') === "multiple";
        this.options.onChange = $.proxy(this.options.onChange, this);
        this.options.onDropdownShow = $.proxy(this.options.onDropdownShow, this);
        this.options.onDropdownHide = $.proxy(this.options.onDropdownHide, this);
        this.options.onDropdownShown = $.proxy(this.options.onDropdownShown, this);
        this.options.onDropdownHidden = $.proxy(this.options.onDropdownHidden, this);
        this.options.onInitialized = $.proxy(this.options.onInitialized, this);

        // Build select all if enabled.
        this.buildContainer();
        this.buildButton();
        this.buildDropdown();
        this.buildSelectAll();
        this.buildDropdownOptions();
        this.buildFilter();

        this.updateButtonText();
        this.updateSelectAll(true);

        if (this.options.disableIfEmpty && $('option', this.$select).length <= 0) {
            this.disable();
        }

        this.$select.hide().after(this.$container);
        this.options.onInitialized(this.$select, this.$container);
    }

    Multiselect.prototype = {

        defaults: {
            /**
             * Default text function will either print 'None selected' in case no
             * option is selected or a list of the selected options up to a length
             * of 3 selected options.
             * 
             * @param {jQuery} options
             * @param {jQuery} select
             * @returns {String}
             */
            buttonText: function (options, select) {
                if (this.disabledText.length > 0
                && (this.disableIfEmpty || select.prop('disabled'))
                && options.length == 0) {

                    return this.disabledText;
                }
                else if (options.length === 0) {
                    return this.nonSelectedText;
                }
                else if (this.allSelectedText
                && options.length === $('option', $(select)).length
                && $('option', $(select)).length !== 1
                && this.multiple) {

                    if (this.selectAllNumber) {
                        return this.allSelectedText + ' (' + options.length + ')';
                    }
                    else {
                        return this.allSelectedText;
                    }
                }
                else if (options.length > this.numberDisplayed) {
                    return options.length + ' ' + this.nSelectedText;
                }
                else {
                    var selected = '';
                    var delimiter = this.delimiterText;

                    options.each(function () {
                        var label = ($(this).attr('label') !== undefined) ? $(this).attr('label') : $(this).text();
                        selected += label + delimiter;
                    }
                    );

                    return selected.substr(0, selected.length - 2);
                }
            },
            /**
             * Updates the title of the button similar to the buttonText function.
             * 
             * @param {jQuery} options
             * @param {jQuery} select
             * @returns {@exp;selected@call;substr}
             */
            buttonTitle: function (options, select) {
                if (options.length === 0) {
                    return this.nonSelectedText;
                }
                else {
                    var selected = '';
                    var delimiter = this.delimiterText;

                    options.each(function () {
                        var label = ($(this).attr('label') !== undefined) ? $(this).attr('label') : $(this).text();
                        selected += label + delimiter;
                    }
                    );
                    return selected.substr(0, selected.length - 2);
                }
            },
            /**
             * Create a label.
             *
             * @param {jQuery} element
             * @returns {String}
             */
            optionLabel: function (element) {
                return $(element).attr('label') || $(element).text();
            },
            /**
             * Create a class.
             *
             * @param {jQuery} element
             * @returns {String}
             */
            optionClass: function (element) {
                return $(element).attr('class') || '';
            },
            /**
             * Triggered on change of the multiselect.
             * 
             * Not triggered when selecting/deselecting options manually.
             * 
             * @param {jQuery} option
             * @param {Boolean} checked
             */
            onChange: function (option, checked) {

            },
            /**
             * Triggered when the dropdown is shown.
             *
             * @param {jQuery} event
             */
            onDropdownShow: function (event) {

            },
            /**
             * Triggered when the dropdown is hidden.
             *
             * @param {jQuery} event
             */
            onDropdownHide: function (event) {

            },
            /**
             * Triggered after the dropdown is shown.
             * 
             * @param {jQuery} event
             */
            onDropdownShown: function (event) {

            },
            /**
             * Triggered after the dropdown is hidden.
             * 
             * @param {jQuery} event
             */
            onDropdownHidden: function (event) {

            },
            /**
             * Triggered on select all.
             */
            onSelectAll: function (checked) {

            },
            /**
             * Triggered after initializing.
             *
             * @param {jQuery} $select
             * @param {jQuery} $container
             */
            onInitialized: function ($select, $container) {

            },
            enableHTML: false,
            buttonClass: 'btn btn-default',
            inheritClass: false,
            buttonWidth: 'auto',
            buttonContainer: '<div class="btn-group" />',
            dropRight: false,
            dropUp: false,
            selectedClass: 'active',
            // Maximum height of the dropdown menu.
            // If maximum height is exceeded a scrollbar will be displayed.
            maxHeight: false,
            checkboxName: false,
            includeSelectAllOption: false,
            includeSelectAllIfMoreThan: 0,
            selectAllText: ' Select all',
            selectAllValue: 'multiselect-all',
            selectAllName: false,
            selectAllNumber: true,
            selectAllJustVisible: true,
            enableFiltering: false,
            enableCaseInsensitiveFiltering: false,
            enableFullValueFiltering: false,
            enableClickableOptGroups: false,
            enableCollapsibelOptGroups: false,
            filterPlaceholder: 'Search',
            // possible options: 'text', 'value', 'both'
            filterBehavior: 'text',
            includeFilterClearBtn: true,
            preventInputChangeEvent: false,
            nonSelectedText: 'None selected',
            nSelectedText: 'selected',
            allSelectedText: 'All selected',
            numberDisplayed: 3,
            disableIfEmpty: false,
            disabledText: '',
            delimiterText: ', ',
            templates: {
                button: '<button type="button" class="multiselect dropdown-toggle" data-toggle="dropdown"><span class="multiselect-selected-text"></span> <b class="caret"></b></button>',
                ul: '<ul class="multiselect-container dropdown-menu"></ul>',
                filter: '<li class="multiselect-item filter"><div class="input-group"><span class="input-group-addon"><i class="glyphicon glyphicon-search"></i></span><input class="form-control multiselect-search" type="text"></div></li>',
                filterClearBtn: '<span class="input-group-btn"><button class="btn btn-default multiselect-clear-filter" type="button"><i class="glyphicon glyphicon-remove-circle"></i></button></span>',
                li: '<li><a tabindex="0"><label></label></a></li>',
                divider: '<li class="multiselect-item divider"></li>',
                liGroup: '<li class="multiselect-item multiselect-group"><label></label></li>'
            }
        },

        constructor: Multiselect,

        /**
         * Builds the container of the multiselect.
         */
        buildContainer: function () {
            this.$container = $(this.options.buttonContainer);
            this.$container.on('show.bs.dropdown', this.options.onDropdownShow);
            this.$container.on('hide.bs.dropdown', this.options.onDropdownHide);
            this.$container.on('shown.bs.dropdown', this.options.onDropdownShown);
            this.$container.on('hidden.bs.dropdown', this.options.onDropdownHidden);
        },

        /**
         * Builds the button of the multiselect.
         */
        buildButton: function () {
            this.$button = $(this.options.templates.button).addClass(this.options.buttonClass);
            if (this.$select.attr('class') && this.options.inheritClass) {
                this.$button.addClass(this.$select.attr('class'));
            }
            // Adopt active state.
            if (this.$select.prop('disabled')) {
                this.disable();
            }
            else {
                this.enable();
            }

            // Manually add button width if set.
            if (this.options.buttonWidth && this.options.buttonWidth !== 'auto') {
                this.$button.css({
                    'width': this.options.buttonWidth,
                    'overflow': 'hidden',
                    'text-overflow': 'ellipsis'
                });
                this.$container.css({
                    'width': this.options.buttonWidth
                });
            }

            // Keep the tab index from the select.
            var tabindex = this.$select.attr('tabindex');
            if (tabindex) {
                this.$button.attr('tabindex', tabindex);
            }

            this.$container.prepend(this.$button);
        },

        /**
         * Builds the ul representing the dropdown menu.
         */
        buildDropdown: function () {

            // Build ul.
            this.$ul = $(this.options.templates.ul);

            if (this.options.dropRight) {
                this.$ul.addClass('pull-right');
            }

            // Set max height of dropdown menu to activate auto scrollbar.
            if (this.options.maxHeight) {
                // TODO: Add a class for this option to move the css declarations.
                this.$ul.css({
                    'max-height': this.options.maxHeight + 'px',
                    'overflow-y': 'auto',
                    'overflow-x': 'hidden'
                });
            }

            if (this.options.dropUp) {

                var height = Math.min(this.options.maxHeight, $('option[data-role!="divider"]', this.$select).length * 26 + $('option[data-role="divider"]', this.$select).length * 19 + (this.options.includeSelectAllOption ? 26 : 0) + (this.options.enableFiltering || this.options.enableCaseInsensitiveFiltering ? 44 : 0));
                var moveCalc = height + 34;

                this.$ul.css({
                    'max-height': height + 'px',
                    'overflow-y': 'auto',
                    'overflow-x': 'hidden',
                    'margin-top': "-" + moveCalc + 'px'
                });
            }

            this.$container.append(this.$ul);
        },

        /**
         * Build the dropdown options and binds all nessecary events.
         * 
         * Uses createDivider and createOptionValue to create the necessary options.
         */
        buildDropdownOptions: function () {

            this.$select.children().each($.proxy(function (index, element) {

                var $element = $(element);
                // Support optgroups and options without a group simultaneously.
                var tag = $element.prop('tagName')
                .toLowerCase();

                if ($element.prop('value') === this.options.selectAllValue) {
                    return;
                }

                if (tag === 'optgroup') {
                    this.createOptgroup(element);
                }
                else if (tag === 'option') {

                    if ($element.data('role') === 'divider') {
                        this.createDivider();
                    }
                    else {
                        this.createOptionValue(element);
                    }

                }

                // Other illegal tags will be ignored.
            }
            , this));

            // Bind the change event on the dropdown elements.
            $('li input', this.$ul).on('change', $.proxy(function (event) {
                var $target = $(event.target);

                var checked = $target.prop('checked') || false;
                var isSelectAllOption = $target.val() === this.options.selectAllValue;

                // Apply or unapply the configured selected class.
                if (this.options.selectedClass) {
                    if (checked) {
                        $target.closest('li')
                        .addClass(this.options.selectedClass);
                    }
                    else {
                        $target.closest('li')
                        .removeClass(this.options.selectedClass);
                    }
                }

                // Get the corresponding option.
                var value = $target.val();
                var $option = this.getOptionByValue(value);

                var $optionsNotThis = $('option', this.$select).not($option);
                var $checkboxesNotThis = $('input', this.$container).not($target);

                if (isSelectAllOption) {
                    if (checked) {
                        this.selectAll(this.options.selectAllJustVisible);
                    }
                    else {
                        this.deselectAll(this.options.selectAllJustVisible);
                    }
                }
                else {
                    if (checked) {
                        $option.prop('selected', true);

                        if (this.options.multiple) {
                            // Simply select additional option.
                            $option.prop('selected', true);
                        }
                        else {
                            // Unselect all other options and corresponding checkboxes.
                            if (this.options.selectedClass) {
                                $($checkboxesNotThis).closest('li').removeClass(this.options.selectedClass);
                            }

                            $($checkboxesNotThis).prop('checked', false);
                            $optionsNotThis.prop('selected', false);

                            // It's a single selection, so close.
                            this.$button.click();
                        }

                        if (this.options.selectedClass === "active") {
                            $optionsNotThis.closest("a").css("outline", "");
                        }
                    }
                    else {
                        // Unselect option.
                        $option.prop('selected', false);
                    }

                    // To prevent select all from firing onChange: #575
                    this.options.onChange($option, checked);
                }

                this.$select.change();

                this.updateButtonText();
                this.updateSelectAll();

                if (this.options.preventInputChangeEvent) {
                    return false;
                }
            }
            , this));

            $('li a', this.$ul).on('mousedown', function (e) {
                if (e.shiftKey) {
                    // Prevent selecting text by Shift+click
                    return false;
                }
            }
            );

            $('li a', this.$ul).on('touchstart click', $.proxy(function (event) {
                event.stopPropagation();

                var $target = $(event.target);

                if (event.shiftKey && this.options.multiple) {
                    if ($target.is("label")) {
                        // Handles checkbox selection manually (see https://github.com/davidstutz/bootstrap-multiselect/issues/431)
                        event.preventDefault();
                        $target = $target.find("input");
                        $target.prop("checked", !$target.prop("checked"));
                    }
                    var checked = $target.prop('checked') || false;

                    if (this.lastToggledInput !== null && this.lastToggledInput !== $target) {
                        // Make sure we actually have a range
                        var from = $target.closest("li").index();
                        var to = this.lastToggledInput.closest("li").index();

                        if (from > to) {
                            // Swap the indices
                            var tmp = to;
                            to = from;
                            from = tmp;
                        }

                        // Make sure we grab all elements since slice excludes the last index
                        ++to;

                        // Change the checkboxes and underlying options
                        var range = this.$ul.find("li").slice(from, to).find("input");

                        range.prop('checked', checked);

                        if (this.options.selectedClass) {
                            range.closest('li')
                            .toggleClass(this.options.selectedClass, checked);
                        }

                        for (var i = 0, j = range.length; i < j; i++) {
                            var $checkbox = $(range[i]);

                            var $option = this.getOptionByValue($checkbox.val());

                            $option.prop('selected', checked);
                        }
                    }

                    // Trigger the select "change" event
                    $target.trigger("change");
                }

                // Remembers last clicked option
                if ($target.is("input") && !$target.closest("li").is(".multiselect-item")) {
                    this.lastToggledInput = $target;
                }

                $target.blur();
            }
            , this));

            // Keyboard support.
            this.$container.off('keydown.multiselect').on('keydown.multiselect', $.proxy(function (event) {
                if ($('input[type="text"]', this.$container).is(':focus')) {
                    return;
                }

                if (event.keyCode === 9 && this.$container.hasClass('open')) {
                    this.$button.click();
                }
                else {
                    var $items = $(this.$container).find("li:not(.divider):not(.disabled) a").filter(":visible");

                    if (!$items.length) {
                        return;
                    }

                    var index = $items.index($items.filter(':focus'));

                    // Navigation up.
                    if (event.keyCode === 38 && index > 0) {
                        index--;
                    }
                        // Navigate down.

                    else if (event.keyCode === 40 && index < $items.length - 1) {
                        index++;
                    }
                    else if (!~index) {
                        index = 0;
                    }

                    var $current = $items.eq(index);
                    $current.focus();

                    if (event.keyCode === 32 || event.keyCode === 13) {
                        var $checkbox = $current.find('input');

                        $checkbox.prop("checked", !$checkbox.prop("checked"));
                        $checkbox.change();
                    }

                    event.stopPropagation();
                    event.preventDefault();
                }
            }
            , this));

            if (this.options.enableClickableOptGroups && this.options.multiple) {
                $('li.multiselect-group', this.$ul).on('click', $.proxy(function (event) {
                    event.stopPropagation();
                    console.log('test');
                    var group = $(event.target).parent();

                    // Search all option in optgroup
                    var $options = group.nextUntil('li.multiselect-group');
                    var $visibleOptions = $options.filter(":visible:not(.disabled)");

                    // check or uncheck items
                    var allChecked = true;
                    var optionInputs = $visibleOptions.find('input');
                    var values = [];

                    optionInputs.each(function () {
                        allChecked = allChecked && $(this).prop('checked');
                        values.push($(this).val());
                    }
                    );

                    if (!allChecked) {
                        this.select(values, false);
                    }
                    else {
                        this.deselect(values, false);
                    }

                    this.options.onChange(optionInputs, !allChecked);
                }
                , this));
            }

            if (this.options.enableCollapsibleOptGroups && this.options.multiple) {
                $("li.multiselect-group input", this.$ul).off();
                $("li.multiselect-group", this.$ul).siblings().not("li.multiselect-group, li.multiselect-all", this.$ul).each(function () {
                    $(this).toggleClass('hidden', true);
                }
                );

                $("li.multiselect-group", this.$ul).on("click", $.proxy(function (group) {
                    group.stopPropagation();
                }
                , this));

                $("li.multiselect-group > a > b", this.$ul).on("click", $.proxy(function (t) {
                    t.stopPropagation();
                    var n = $(t.target).closest('li');
                    var r = n.nextUntil("li.multiselect-group");
                    var i = true;

                    r.each(function () {
                        i = i && $(this).hasClass('hidden');
                    }
                    );

                    r.toggleClass('hidden', !i);
                }
                , this));

                $("li.multiselect-group > a > input", this.$ul).on("change", $.proxy(function (t) {
                    t.stopPropagation();
                    var n = $(t.target).closest('li');
                    var r = n.nextUntil("li.multiselect-group", ':not(.disabled)');
                    var s = r.find("input");

                    var i = true;
                    s.each(function () {
                        i = i && $(this).prop("checked");
                    }
                    );

                    s.prop("checked", !i).trigger("change");
                }
                , this));

                // Set the initial selection state of the groups.
                $('li.multiselect-group', this.$ul).each(function () {
                    var r = $(this).nextUntil("li.multiselect-group", ':not(.disabled)');
                    var s = r.find("input");

                    var i = true;
                    s.each(function () {
                        i = i && $(this).prop("checked");
                    }
                    );

                    $(this).find('input').prop("checked", i);
                }
                );

                // Update the group checkbox based on new selections among the
                // corresponding children.
                $("li input", this.$ul).on("change", $.proxy(function (t) {
                    t.stopPropagation();
                    var n = $(t.target).closest('li');
                    var r1 = n.prevUntil("li.multiselect-group", ':not(.disabled)');
                    var r2 = n.nextUntil("li.multiselect-group", ':not(.disabled)');
                    var s1 = r1.find("input");
                    var s2 = r2.find("input");

                    var i = $(t.target).prop('checked');
                    s1.each(function () {
                        i = i && $(this).prop("checked");
                    }
                    );

                    s2.each(function () {
                        i = i && $(this).prop("checked");
                    }
                    );

                    n.prevAll('.multiselect-group').find('input').prop('checked', i);
                }
                , this));

                $("li.multiselect-all", this.$ul).css('background', '#f3f3f3').css('border-bottom', '1px solid #eaeaea');
                $("li.multiselect-group > a, li.multiselect-all > a > label.checkbox", this.$ul).css('padding', '3px 20px 3px 35px');
                $("li.multiselect-group > a > input", this.$ul).css('margin', '4px 0px 5px -20px');
            }
        },

        /**
         * Create an option using the given select option.
         *
         * @param {jQuery} element
         */
        createOptionValue: function (element) {
            var $element = $(element);
            if ($element.is(':selected')) {
                $element.prop('selected', true);
            }

            // Support the label attribute on options.
            var label = this.options.optionLabel(element);
            var classes = this.options.optionClass(element);
            var value = $element.val();
            var inputType = this.options.multiple ? "checkbox" : "radio";

            var $li = $(this.options.templates.li);
            var $label = $('label', $li);
            $label.addClass(inputType);
            $li.addClass(classes);

            if (this.options.enableHTML) {
                $label.html(" " + label);
            }
            else {
                $label.text(" " + label);
            }

            var $checkbox = $('<input/>').attr('type', inputType);

            if (this.options.checkboxName) {
                $checkbox.attr('name', this.options.checkboxName);
            }
            $label.prepend($checkbox);

            var selected = $element.prop('selected') || false;
            $checkbox.val(value);

            if (value === this.options.selectAllValue) {
                $li.addClass("multiselect-item multiselect-all");
                $checkbox.parent().parent()
                .addClass('multiselect-all');
            }

            $label.attr('title', $element.attr('title'));

            this.$ul.append($li);

            if ($element.is(':disabled')) {
                $checkbox.attr('disabled', 'disabled')
                .prop('disabled', true)
                .closest('a')
                .attr("tabindex", "-1")
                .closest('li')
                .addClass('disabled');
            }

            $checkbox.prop('checked', selected);

            if (selected && this.options.selectedClass) {
                $checkbox.closest('li')
                .addClass(this.options.selectedClass);
            }
        },

        /**
         * Creates a divider using the given select option.
         *
         * @param {jQuery} element
         */
        createDivider: function (element) {
            var $divider = $(this.options.templates.divider);
            this.$ul.append($divider);
        },

        /**
         * Creates an optgroup.
         *
         * @param {jQuery} group
         */
        createOptgroup: function (group) {
            if (this.options.enableCollapsibleOptGroups && this.options.multiple) {
                var label = $(group).attr("label");
                var value = $(group).attr("value");
                var r = $('<li class="multiselect-item multiselect-group"><a href="javascript:void(0);"><input type="checkbox" value="' + value + '"/><b> ' + label + '<b class="caret"></b></b></a></li>');

                if (this.options.enableClickableOptGroups) {
                    r.addClass("multiselect-group-clickable")
                }
                this.$ul.append(r);
                if ($(group).is(":disabled")) {
                    r.addClass("disabled")
                }
                $("option", group).each($.proxy(function ($, group) {
                    this.createOptionValue(group)
                }
                , this))
            }
            else {
                var groupName = $(group).prop('label');

                // Add a header for the group.
                var $li = $(this.options.templates.liGroup);

                if (this.options.enableHTML) {
                    $('label', $li).html(groupName);
                }
                else {
                    $('label', $li).text(groupName);
                }

                if (this.options.enableClickableOptGroups) {
                    $li.addClass('multiselect-group-clickable');
                }

                this.$ul.append($li);

                if ($(group).is(':disabled')) {
                    $li.addClass('disabled');
                }

                // Add the options of the group.
                $('option', group).each($.proxy(function (index, element) {
                    this.createOptionValue(element);
                }
                , this));
            }
        },

        /**
         * Build the select all.
         * 
         * Checks if a select all has already been created.
         */
        buildSelectAll: function () {
            if (typeof this.options.selectAllValue === 'number') {
                this.options.selectAllValue = this.options.selectAllValue.toString();
            }

            var alreadyHasSelectAll = this.hasSelectAll();

            if (!alreadyHasSelectAll && this.options.includeSelectAllOption && this.options.multiple
            && $('option', this.$select).length > this.options.includeSelectAllIfMoreThan) {

                // Check whether to add a divider after the select all.
                if (this.options.includeSelectAllDivider) {
                    this.$ul.prepend($(this.options.templates.divider));
                }

                var $li = $(this.options.templates.li);
                $('label', $li).addClass("checkbox");

                if (this.options.enableHTML) {
                    $('label', $li).html(" " + this.options.selectAllText);
                }
                else {
                    $('label', $li).text(" " + this.options.selectAllText);
                }

                if (this.options.selectAllName) {
                    $('label', $li).prepend('<input type="checkbox" name="' + this.options.selectAllName + '" />');
                }
                else {
                    $('label', $li).prepend('<input type="checkbox" />');
                }

                var $checkbox = $('input', $li);
                $checkbox.val(this.options.selectAllValue);

                $li.addClass("multiselect-item multiselect-all");
                $checkbox.parent().parent()
                .addClass('multiselect-all');

                this.$ul.prepend($li);

                $checkbox.prop('checked', false);
            }
        },

        /**
         * Builds the filter.
         */
        buildFilter: function () {

            // Build filter if filtering OR case insensitive filtering is enabled and the number of options exceeds (or equals) enableFilterLength.
            if (this.options.enableFiltering || this.options.enableCaseInsensitiveFiltering) {
                var enableFilterLength = Math.max(this.options.enableFiltering, this.options.enableCaseInsensitiveFiltering);

                if (this.$select.find('option').length >= enableFilterLength) {

                    this.$filter = $(this.options.templates.filter);
                    $('input', this.$filter).attr('placeholder', this.options.filterPlaceholder);

                    // Adds optional filter clear button
                    if (this.options.includeFilterClearBtn) {
                        var clearBtn = $(this.options.templates.filterClearBtn);
                        clearBtn.on('click', $.proxy(function (event) {
                            clearTimeout(this.searchTimeout);
                            this.$filter.find('.multiselect-search').val('');
                            $('li', this.$ul).show().removeClass("filter-hidden");
                            this.updateSelectAll();
                        }
                        , this));
                        this.$filter.find('.input-group').append(clearBtn);
                    }

                    this.$ul.prepend(this.$filter);

                    this.$filter.val(this.query).on('click', function (event) {
                        event.stopPropagation();
                    }
                    ).on('input keydown', $.proxy(function (event) {
                        // Cancel enter key default behaviour
                        if (event.which === 13) {
                            event.preventDefault();
                        }

                        // This is useful to catch "keydown" events after the browser has updated the control.
                        clearTimeout(this.searchTimeout);

                        this.searchTimeout = this.asyncFunction($.proxy(function () {

                            if (this.query !== event.target.value) {
                                this.query = event.target.value;

                                var currentGroup, currentGroupVisible;
                                $.each($('li', this.$ul), $.proxy(function (index, element) {
                                    var value = $('input', element).length > 0 ? $('input', element).val() : "";
                                    var text = $('label', element).text();

                                    var filterCandidate = '';
                                    if ((this.options.filterBehavior === 'text')) {
                                        filterCandidate = text;
                                    }
                                    else if ((this.options.filterBehavior === 'value')) {
                                        filterCandidate = value;
                                    }
                                    else if (this.options.filterBehavior === 'both') {
                                        filterCandidate = text + '\n' + value;
                                    }

                                    if (value !== this.options.selectAllValue && text) {

                                        // By default lets assume that element is not
                                        // interesting for this search.
                                        var showElement = false;

                                        if (this.options.enableCaseInsensitiveFiltering) {
                                            filterCandidate = filterCandidate.toLowerCase();
                                            this.query = this.query.toLowerCase();
                                        }

                                        if (this.options.enableFullValueFiltering && this.options.filterBehavior !== 'both') {
                                            var valueToMatch = filterCandidate.trim().substring(0, this.query.length);
                                            if (this.query.indexOf(valueToMatch) > -1) {
                                                showElement = true;
                                            }
                                        }
                                        else if (filterCandidate.indexOf(this.query) > -1) {
                                            showElement = true;
                                        }

                                        // Toggle current element (group or group item) according to showElement boolean.
                                        $(element).toggle(showElement).toggleClass('filter-hidden', !showElement);

                                        // Differentiate groups and group items.
                                        if ($(element).hasClass('multiselect-group')) {
                                            // Remember group status.
                                            currentGroup = element;
                                            currentGroupVisible = showElement;
                                        }
                                        else {
                                            // Show group name when at least one of its items is visible.
                                            if (showElement) {
                                                $(currentGroup).show().removeClass('filter-hidden');
                                            }

                                            // Show all group items when group name satisfies filter.
                                            if (!showElement && currentGroupVisible) {
                                                $(element).show().removeClass('filter-hidden');
                                            }
                                        }
                                    }
                                }
                                , this));
                            }

                            this.updateSelectAll();
                        }
                        , this), 300, this);
                    }
                    , this));
                }
            }
        },

        /**
         * Unbinds the whole plugin.
         */
        destroy: function () {
            this.$container.remove();
            this.$select.show();
            this.$select.data('multiselect', null);
        },

        /**
         * Refreshs the multiselect based on the selected options of the select.
         */
        refresh: function () {
            var inputs = $.map($('li input', this.$ul), $);

            $('option', this.$select).each($.proxy(function (index, element) {
                var $elem = $(element);
                var value = $elem.val();
                var $input;
                for (var i = inputs.length; 0 < i--; /**/) {
                    if (value !== ($input = inputs[i]).val())
                        continue;// wrong li

                    if ($elem.is(':selected')) {
                        $input.prop('checked', true);

                        if (this.options.selectedClass) {
                            $input.closest('li')
                            .addClass(this.options.selectedClass);
                        }
                    }
                    else {
                        $input.prop('checked', false);

                        if (this.options.selectedClass) {
                            $input.closest('li')
                            .removeClass(this.options.selectedClass);
                        }
                    }

                    if ($elem.is(":disabled")) {
                        $input.attr('disabled', 'disabled')
                        .prop('disabled', true)
                        .closest('li')
                        .addClass('disabled');
                    }
                    else {
                        $input.prop('disabled', false)
                        .closest('li')
                        .removeClass('disabled');
                    }
                    break;
                    // assumes unique values
                }
            }
            , this));

            this.updateButtonText();
            this.updateSelectAll();
        },

        /**
         * Select all options of the given values.
         * 
         * If triggerOnChange is set to true, the on change event is triggered if
         * and only if one value is passed.
         * 
         * @param {Array} selectValues
         * @param {Boolean} triggerOnChange
         */
        select: function (selectValues, triggerOnChange) {
            if (!$.isArray(selectValues)) {
                selectValues = [selectValues];
            }

            for (var i = 0; i < selectValues.length; i++) {
                var value = selectValues[i];

                if (value === null || value === undefined) {
                    continue;
                }

                var $option = this.getOptionByValue(value);
                var $checkbox = this.getInputByValue(value);

                if ($option === undefined || $checkbox === undefined) {
                    continue;
                }

                if (!this.options.multiple) {
                    this.deselectAll(false);
                }

                if (this.options.selectedClass) {
                    $checkbox.closest('li')
                    .addClass(this.options.selectedClass);
                }

                $checkbox.prop('checked', true);
                $option.prop('selected', true);

                if (triggerOnChange) {
                    this.options.onChange($option, true);
                }
            }

            this.updateButtonText();
            this.updateSelectAll();
        },

        /**
         * Clears all selected items.
         */
        clearSelection: function () {
            this.deselectAll(false);
            this.updateButtonText();
            this.updateSelectAll();
        },

        /**
         * Deselects all options of the given values.
         * 
         * If triggerOnChange is set to true, the on change event is triggered, if
         * and only if one value is passed.
         * 
         * @param {Array} deselectValues
         * @param {Boolean} triggerOnChange
         */
        deselect: function (deselectValues, triggerOnChange) {
            if (!$.isArray(deselectValues)) {
                deselectValues = [deselectValues];
            }

            for (var i = 0; i < deselectValues.length; i++) {
                var value = deselectValues[i];

                if (value === null || value === undefined) {
                    continue;
                }

                var $option = this.getOptionByValue(value);
                var $checkbox = this.getInputByValue(value);

                if ($option === undefined || $checkbox === undefined) {
                    continue;
                }

                if (this.options.selectedClass) {
                    $checkbox.closest('li')
                    .removeClass(this.options.selectedClass);
                }

                $checkbox.prop('checked', false);
                $option.prop('selected', false);

                if (triggerOnChange) {
                    this.options.onChange($option, false);
                }
            }

            this.updateButtonText();
            this.updateSelectAll();
        },

        /**
         * Selects all enabled & visible options.
         *
         * If justVisible is true or not specified, only visible options are selected.
         *
         * @param {Boolean} justVisible
         * @param {Boolean} triggerOnSelectAll
         */
        selectAll: function (justVisible, triggerOnSelectAll) {
            justVisible = (this.options.enableCollapsibleOptGroups && this.options.multiple) ? false : justVisible;

            var justVisible = typeof justVisible === 'undefined' ? true : justVisible;
            var allCheckboxes = $("li input[type='checkbox']:enabled", this.$ul);
            var visibleCheckboxes = allCheckboxes.filter(":visible");
            var allCheckboxesCount = allCheckboxes.length;
            var visibleCheckboxesCount = visibleCheckboxes.length;

            if (justVisible) {
                visibleCheckboxes.prop('checked', true);
                $("li:not(.divider):not(.disabled)", this.$ul).filter(":visible").addClass(this.options.selectedClass);
            }
            else {
                allCheckboxes.prop('checked', true);
                $("li:not(.divider):not(.disabled)", this.$ul).addClass(this.options.selectedClass);
            }

            if (allCheckboxesCount === visibleCheckboxesCount || justVisible === false) {
                $("option:not([data-role='divider']):enabled", this.$select).prop('selected', true);
            }
            else {
                var values = visibleCheckboxes.map(function () {
                    return $(this).val();
                }
                ).get();

                $("option:enabled", this.$select).filter(function (index) {
                    return $.inArray($(this).val(), values) !== -1;
                }
                ).prop('selected', true);
            }

            if (triggerOnSelectAll) {
                this.options.onSelectAll();
            }
        },

        /**
         * Deselects all options.
         * 
         * If justVisible is true or not specified, only visible options are deselected.
         * 
         * @param {Boolean} justVisible
         */
        deselectAll: function (justVisible) {
            justVisible = (this.options.enableCollapsibleOptGroups && this.options.multiple) ? false : justVisible;
            justVisible = typeof justVisible === 'undefined' ? true : justVisible;

            if (justVisible) {
                var visibleCheckboxes = $("li input[type='checkbox']:not(:disabled)", this.$ul).filter(":visible");
                visibleCheckboxes.prop('checked', false);

                var values = visibleCheckboxes.map(function () {
                    return $(this).val();
                }
                ).get();

                $("option:enabled", this.$select).filter(function (index) {
                    return $.inArray($(this).val(), values) !== -1;
                }
                ).prop('selected', false);

                if (this.options.selectedClass) {
                    $("li:not(.divider):not(.disabled)", this.$ul).filter(":visible").removeClass(this.options.selectedClass);
                }
            }
            else {
                $("li input[type='checkbox']:enabled", this.$ul).prop('checked', false);
                $("option:enabled", this.$select).prop('selected', false);

                if (this.options.selectedClass) {
                    $("li:not(.divider):not(.disabled)", this.$ul).removeClass(this.options.selectedClass);
                }
            }
        },

        /**
         * Rebuild the plugin.
         * 
         * Rebuilds the dropdown, the filter and the select all option.
         */
        rebuild: function () {
            this.$ul.html('');

            // Important to distinguish between radios and checkboxes.
            this.options.multiple = this.$select.attr('multiple') === "multiple";

            this.buildSelectAll();
            this.buildDropdownOptions();
            this.buildFilter();

            this.updateButtonText();
            this.updateSelectAll(true);

            if (this.options.disableIfEmpty && $('option', this.$select).length <= 0) {
                this.disable();
            }
            else {
                this.enable();
            }

            if (this.options.dropRight) {
                this.$ul.addClass('pull-right');
            }
        },

        /**
         * The provided data will be used to build the dropdown.
         */
        dataprovider: function (dataprovider) {

            var groupCounter = 0;
            var $select = this.$select.empty();

            $.each(dataprovider, function (index, option) {
                var $tag;

                if ($.isArray(option.children)) {
                    // create optiongroup tag
                    groupCounter++;

                    $tag = $('<optgroup/>').attr({
                        label: option.label || 'Group ' + groupCounter,
                        disabled: !!option.disabled
                    });

                    forEach(option.children, function (subOption) {
                        // add children option tags
                        $tag.append($('<option/>').attr({
                            value: subOption.value,
                            label: subOption.label || subOption.value,
                            title: subOption.title,
                            selected: !!subOption.selected,
                            disabled: !!subOption.disabled
                        }));
                    }
                    );
                }
                else {
                    $tag = $('<option/>').attr({
                        value: option.value,
                        label: option.label || option.value,
                        title: option.title,
                        class: option.class,
                        selected: !!option.selected,
                        disabled: !!option.disabled
                    });
                    $tag.text(option.label || option.value);
                }

                $select.append($tag);
            }
            );

            this.rebuild();
        },

        /**
         * Enable the multiselect.
         */
        enable: function () {
            this.$select.prop('disabled', false);
            this.$button.prop('disabled', false)
            .removeClass('disabled');
        },

        /**
         * Disable the multiselect.
         */
        disable: function () {
            this.$select.prop('disabled', true);
            this.$button.prop('disabled', true)
            .addClass('disabled');
        },

        /**
         * Set the options.
         *
         * @param {Array} options
         */
        setOptions: function (options) {
            this.options = this.mergeOptions(options);
        },

        /**
         * Merges the given options with the default options.
         *
         * @param {Array} options
         * @returns {Array}
         */
        mergeOptions: function (options) {
            return $.extend(true, {}, this.defaults, this.options, options);
        },

        /**
         * Checks whether a select all checkbox is present.
         *
         * @returns {Boolean}
         */
        hasSelectAll: function () {
            return $('li.multiselect-all', this.$ul).length > 0;
        },

        /**
         * Updates the select all checkbox based on the currently displayed and selected checkboxes.
         */
        updateSelectAll: function (notTriggerOnSelectAll) {
            if (this.hasSelectAll()) {
                var allBoxes = $("li:not(.multiselect-item):not(.filter-hidden) input:enabled", this.$ul);
                var allBoxesLength = allBoxes.length;
                var checkedBoxesLength = allBoxes.filter(":checked").length;
                var selectAllLi = $("li.multiselect-all", this.$ul);
                var selectAllInput = selectAllLi.find("input");

                if (checkedBoxesLength > 0 && checkedBoxesLength === allBoxesLength) {
                    selectAllInput.prop("checked", true);
                    selectAllLi.addClass(this.options.selectedClass);
                    this.options.onSelectAll(true);
                }
                else {
                    selectAllInput.prop("checked", false);
                    selectAllLi.removeClass(this.options.selectedClass);
                    if (checkedBoxesLength === 0) {
                        if (!notTriggerOnSelectAll) {
                            this.options.onSelectAll(false);
                        }
                    }
                }
            }
        },

        /**
         * Update the button text and its title based on the currently selected options.
         */
        updateButtonText: function () {
            var options = this.getSelected();

            // First update the displayed button text.
            if (this.options.enableHTML) {
                $('.multiselect .multiselect-selected-text', this.$container).html(this.options.buttonText(options, this.$select));
            }
            else {
                $('.multiselect .multiselect-selected-text', this.$container).text(this.options.buttonText(options, this.$select));
            }

            // Now update the title attribute of the button.
            $('.multiselect', this.$container).attr('title', this.options.buttonTitle(options, this.$select));
        },

        /**
         * Get all selected options.
         *
         * @returns {jQUery}
         */
        getSelected: function () {
            return $('option', this.$select).filter(":selected");
        },

        /**
         * Gets a select option by its value.
         *
         * @param {String} value
         * @returns {jQuery}
         */
        getOptionByValue: function (value) {

            var options = $('option', this.$select);
            var valueToCompare = value.toString();

            for (var i = 0; i < options.length; i = i + 1) {
                var option = options[i];
                if (option.value === valueToCompare) {
                    return $(option);
                }
            }
        },

        /**
         * Get the input (radio/checkbox) by its value.
         *
         * @param {String} value
         * @returns {jQuery}
         */
        getInputByValue: function (value) {

            var checkboxes = $('li input', this.$ul);
            var valueToCompare = value.toString();

            for (var i = 0; i < checkboxes.length; i = i + 1) {
                var checkbox = checkboxes[i];
                if (checkbox.value === valueToCompare) {
                    return $(checkbox);
                }
            }
        },

        /**
         * Used for knockout integration.
         */
        updateOriginalOptions: function () {
            this.originalOptions = this.$select.clone()[0].options;
        },

        asyncFunction: function (callback, timeout, self) {
            var args = Array.prototype.slice.call(arguments, 3);
            return setTimeout(function () {
                callback.apply(self || window, args);
            }
            , timeout);
        },

        setAllSelectedText: function (allSelectedText) {
            this.options.allSelectedText = allSelectedText;
            this.updateButtonText();
        }
    };

    $.fn.multiselect = function (option, parameter, extraOptions) {
        return this.each(function () {
            var data = $(this).data('multiselect');
            var options = typeof option === 'object' && option;

            // Initialize the multiselect.
            if (!data) {
                data = new Multiselect(this, options);
                $(this).data('multiselect', data);
            }

            // Call multiselect method.
            if (typeof option === 'string') {
                data[option](parameter, extraOptions);

                if (option === 'destroy') {
                    $(this).data('multiselect', false);
                }
            }
        }
        );
    }
    ;

    $.fn.multiselect.Constructor = Multiselect;

    $(function () {
        $("select[data-role=multiselect]").multiselect();
    }
    );

}
(window.jQuery);





//! moment.js
//! version : 2.9.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {
    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = '2.9.0',
        // the global-scope this is NOT the global object in Node.js
        globalScope = (typeof global !== 'undefined' && (typeof window === 'undefined' || window === global.window)) ? global : this,
        oldGlobalMoment,
        round = Math.round,
        hasOwnProperty = Object.prototype.hasOwnProperty,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for locale config files
        locales = {},

        // extra moment internal properties (plugins register props here)
        momentProperties = [],

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|x|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenOffsetMs = /[\+\-]?\d+/, // 1234567890123
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker '+10:00' > ['10', '00'] or '-1530' > ['-', '15', '30']
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds': 1,
            'Seconds': 1e3,
            'Minutes': 6e4,
            'Hours': 36e5,
            'Days': 864e5,
            'Months': 2592e6,
            'Years': 31536e6
        },

        unitAliases = {
            ms: 'millisecond',
            s: 'second',
            m: 'minute',
            h: 'hour',
            d: 'day',
            D: 'date',
            w: 'week',
            W: 'isoWeek',
            M: 'month',
            Q: 'quarter',
            y: 'year',
            DDD: 'dayOfYear',
            e: 'weekday',
            E: 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear: 'dayOfYear',
            isoweekday: 'isoWeekday',
            isoweek: 'isoWeek',
            weekyear: 'weekYear',
            isoweekyear: 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M: function () {
                return this.month() + 1;
            },
            MMM: function (format) {
                return this.localeData().monthsShort(this, format);
            },
            MMMM: function (format) {
                return this.localeData().months(this, format);
            },
            D: function () {
                return this.date();
            },
            DDD: function () {
                return this.dayOfYear();
            },
            d: function () {
                return this.day();
            },
            dd: function (format) {
                return this.localeData().weekdaysMin(this, format);
            },
            ddd: function (format) {
                return this.localeData().weekdaysShort(this, format);
            },
            dddd: function (format) {
                return this.localeData().weekdays(this, format);
            },
            w: function () {
                return this.week();
            },
            W: function () {
                return this.isoWeek();
            },
            YY: function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY: function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY: function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY: function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg: function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg: function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg: function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG: function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG: function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG: function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e: function () {
                return this.weekday();
            },
            E: function () {
                return this.isoWeekday();
            },
            a: function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), true);
            },
            A: function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), false);
            },
            H: function () {
                return this.hours();
            },
            h: function () {
                return this.hours() % 12 || 12;
            },
            m: function () {
                return this.minutes();
            },
            s: function () {
                return this.seconds();
            },
            S: function () {
                return toInt(this.milliseconds() / 100);
            },
            SS: function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS: function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS: function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z: function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ: function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z: function () {
                return this.zoneAbbr();
            },
            zz: function () {
                return this.zoneName();
            },
            x: function () {
                return this.valueOf();
            },
            X: function () {
                return this.unix();
            },
            Q: function () {
                return this.quarter();
            }
        },

        deprecations = {},

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'],

        updateInProgress = false;

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error('Implement me');
        }
    }

    function hasOwnProp(a, b) {
        return hasOwnProperty.call(a, b);
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty: false,
            unusedTokens: [],
            unusedInput: [],
            overflow: -2,
            charsLeftOver: 0,
            nullInput: false,
            invalidMonth: null,
            invalidFormat: false,
            userInvalidated: false,
            iso: false
        };
    }

    function printMsg(msg) {
        if (moment.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                printMsg(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            printMsg(msg);
            deprecations[name] = true;
        }
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.localeData().ordinal(func.call(this, a), period);
        };
    }

    function monthDiff(a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    function meridiemFixWrap(locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // thie is not supposed to happen
            return hour;
        }
    }

    /************************************
        Constructors
    ************************************/

    function Locale() {
    }

    // Moment prototype object
    function Moment(config, skipOverflow) {
        if (skipOverflow !== false) {
            checkOverflow(config);
        }
        copyConfig(this, config);
        this._d = new Date(+config._d);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            moment.updateOffset(this);
            updateInProgress = false;
        }
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = moment.localeData();

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = { milliseconds: 0, months: 0 };

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = moment.duration(val, period);
            addOrSubtractDurationFromMoment(this, dur, direction);
            return this;
        };
    }

    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment._locale[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment._locale, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 24 ||
                    (m._a[HOUR] === 24 && (m._a[MINUTE] !== 0 ||
                                           m._a[SECOND] !== 0 ||
                                           m._a[MILLISECOND] !== 0)) ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0 &&
                    m._pf.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        if (!locales[name] && hasModule) {
            try {
                oldLocale = moment.locale();
                require('./locale/' + name);
                // because defineLocale currently also sets the global locale, we want to undo that for lazy loaded locales
                moment.locale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // Return a moment from input, that is local/utc/utcOffset equivalent to
    // model.
    function makeAs(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (moment.isMoment(input) || isDate(input) ?
                    +input : +moment(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            moment.updateOffset(res, false);
            return res;
        } else {
            return moment(input).local();
        }
    }

    /************************************
        Locale
    ************************************/


    extend(Locale.prototype, {

        set: function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
            // Lenient ordinal parsing accepts just a number in addition to
            // number + (possibly) stuff coming from _ordinalParseLenient.
            this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + /\d{1,2}/.source);
        },

        _months: 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
        months: function (m) {
            return this._months[m.month()];
        },

        _monthsShort: 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
        monthsShort: function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse: function (monthName, format, strict) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = moment.utc([2000, i]);
                if (strict && !this._longMonthsParse[i]) {
                    this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                    this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
                }
                if (!strict && !this._monthsParse[i]) {
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                    return i;
                } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                    return i;
                } else if (!strict && this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays: 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
        weekdays: function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
        weekdaysShort: function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin: 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
        weekdaysMin: function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse: function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat: {
            LTS: 'h:mm:ss A',
            LT: 'h:mm A',
            L: 'MM/DD/YYYY',
            LL: 'MMMM D, YYYY',
            LLL: 'MMMM D, YYYY LT',
            LLLL: 'dddd, MMMM D, YYYY LT'
        },
        longDateFormat: function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM: function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse: /[ap]\.?m?\.?/i,
        meridiem: function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },


        _calendar: {
            sameDay: '[Today at] LT',
            nextDay: '[Tomorrow at] LT',
            nextWeek: 'dddd [at] LT',
            lastDay: '[Yesterday at] LT',
            lastWeek: '[Last] dddd [at] LT',
            sameElse: 'L'
        },
        calendar: function (key, mom, now) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom, [now]) : output;
        },

        _relativeTime: {
            future: 'in %s',
            past: '%s ago',
            s: 'a few seconds',
            m: 'a minute',
            mm: '%d minutes',
            h: 'an hour',
            hh: '%d hours',
            d: 'a day',
            dd: '%d days',
            M: 'a month',
            MM: '%d months',
            y: 'a year',
            yy: '%d years'
        },

        relativeTime: function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture: function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal: function (number) {
            return this._ordinal.replace('%d', number);
        },
        _ordinal: '%d',
        _ordinalParse: /\d{1,2}/,

        preparse: function (string) {
            return string;
        },

        postformat: function (string) {
            return string;
        },

        week: function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week: {
            dow: 0, // Sunday is the first day of the week.
            doy: 6  // The week that contains Jan 1st is the first week of the year.
        },

        firstDayOfWeek: function () {
            return this._week.dow;
        },

        firstDayOfYear: function () {
            return this._week.doy;
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
            case 'Q':
                return parseTokenOneDigit;
            case 'DDDD':
                return parseTokenThreeDigits;
            case 'YYYY':
            case 'GGGG':
            case 'gggg':
                return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
            case 'Y':
            case 'G':
            case 'g':
                return parseTokenSignedNumber;
            case 'YYYYYY':
            case 'YYYYY':
            case 'GGGGG':
            case 'ggggg':
                return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
            case 'S':
                if (strict) {
                    return parseTokenOneDigit;
                }
                /* falls through */
            case 'SS':
                if (strict) {
                    return parseTokenTwoDigits;
                }
                /* falls through */
            case 'SSS':
                if (strict) {
                    return parseTokenThreeDigits;
                }
                /* falls through */
            case 'DDD':
                return parseTokenOneToThreeDigits;
            case 'MMM':
            case 'MMMM':
            case 'dd':
            case 'ddd':
            case 'dddd':
                return parseTokenWord;
            case 'a':
            case 'A':
                return config._locale._meridiemParse;
            case 'x':
                return parseTokenOffsetMs;
            case 'X':
                return parseTokenTimestampMs;
            case 'Z':
            case 'ZZ':
                return parseTokenTimezone;
            case 'T':
                return parseTokenT;
            case 'SSSS':
                return parseTokenDigits;
            case 'MM':
            case 'DD':
            case 'YY':
            case 'GG':
            case 'gg':
            case 'HH':
            case 'hh':
            case 'mm':
            case 'ss':
            case 'ww':
            case 'WW':
                return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
            case 'M':
            case 'D':
            case 'd':
            case 'H':
            case 'h':
            case 'm':
            case 's':
            case 'w':
            case 'W':
            case 'e':
            case 'E':
                return parseTokenOneOrTwoDigits;
            case 'Do':
                return strict ? config._locale._ordinalParse : config._locale._ordinalParseLenient;
            default:
                a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), 'i'));
                return a;
        }
    }

    function utcOffsetFromString(string) {
        string = string || '';
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
            // QUARTER
            case 'Q':
                if (input != null) {
                    datePartArray[MONTH] = (toInt(input) - 1) * 3;
                }
                break;
                // MONTH
            case 'M': // fall through to MM
            case 'MM':
                if (input != null) {
                    datePartArray[MONTH] = toInt(input) - 1;
                }
                break;
            case 'MMM': // fall through to MMMM
            case 'MMMM':
                a = config._locale.monthsParse(input, token, config._strict);
                // if we didn't find a month name, mark the date as invalid.
                if (a != null) {
                    datePartArray[MONTH] = a;
                } else {
                    config._pf.invalidMonth = input;
                }
                break;
                // DAY OF MONTH
            case 'D': // fall through to DD
            case 'DD':
                if (input != null) {
                    datePartArray[DATE] = toInt(input);
                }
                break;
            case 'Do':
                if (input != null) {
                    datePartArray[DATE] = toInt(parseInt(
                                input.match(/\d{1,2}/)[0], 10));
                }
                break;
                // DAY OF YEAR
            case 'DDD': // fall through to DDDD
            case 'DDDD':
                if (input != null) {
                    config._dayOfYear = toInt(input);
                }

                break;
                // YEAR
            case 'YY':
                datePartArray[YEAR] = moment.parseTwoDigitYear(input);
                break;
            case 'YYYY':
            case 'YYYYY':
            case 'YYYYYY':
                datePartArray[YEAR] = toInt(input);
                break;
                // AM / PM
            case 'a': // fall through to A
            case 'A':
                config._meridiem = input;
                // config._isPm = config._locale.isPM(input);
                break;
                // HOUR
            case 'h': // fall through to hh
            case 'hh':
                config._pf.bigHour = true;
                /* falls through */
            case 'H': // fall through to HH
            case 'HH':
                datePartArray[HOUR] = toInt(input);
                break;
                // MINUTE
            case 'm': // fall through to mm
            case 'mm':
                datePartArray[MINUTE] = toInt(input);
                break;
                // SECOND
            case 's': // fall through to ss
            case 'ss':
                datePartArray[SECOND] = toInt(input);
                break;
                // MILLISECOND
            case 'S':
            case 'SS':
            case 'SSS':
            case 'SSSS':
                datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
                break;
                // UNIX OFFSET (MILLISECONDS)
            case 'x':
                config._d = new Date(toInt(input));
                break;
                // UNIX TIMESTAMP WITH MS
            case 'X':
                config._d = new Date(parseFloat(input) * 1000);
                break;
                // TIMEZONE
            case 'Z': // fall through to ZZ
            case 'ZZ':
                config._useUTC = true;
                config._tzm = utcOffsetFromString(input);
                break;
                // WEEKDAY - human
            case 'dd':
            case 'ddd':
            case 'dddd':
                a = config._locale.weekdaysParse(input);
                // if we didn't get a weekday name, mark the date as invalid
                if (a != null) {
                    config._w = config._w || {};
                    config._w['d'] = a;
                } else {
                    config._pf.invalidWeekday = input;
                }
                break;
                // WEEK, WEEK DAY - numeric
            case 'w':
            case 'ww':
            case 'W':
            case 'WW':
            case 'd':
            case 'e':
            case 'E':
                token = token.substr(0, 1);
                /* falls through */
            case 'gggg':
            case 'GGGG':
            case 'GGGGG':
                token = token.substr(0, 2);
                if (input) {
                    config._w = config._w || {};
                    config._w[token] = toInt(input);
                }
                break;
            case 'gg':
            case 'GG':
                config._w = config._w || {};
                config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day || normalizedInput.date,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._pf.bigHour === true && config._a[HOUR] <= 12) {
            config._pf.bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR],
                config._meridiem);
        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be 'T' or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += 'Z';
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ((matched = aspNetJsonRegex.exec(input)) !== null) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            dateFromConfig(config);
        } else if (typeof (input) === 'object') {
            dateFromObject(config);
        } else if (typeof (input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, locale) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = locale;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ? dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f,
            res;

        config._locale = config._locale || moment.localeData(config._l);

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({ nullInput: true });
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (moment.isMoment(input)) {
            return new Moment(input, true);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        res = new Moment(config);
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    moment = function (input, format, locale, strict) {
        var c;

        if (typeof (locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = locale;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, locale, strict) {
        var c;

        if (typeof (locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () { };

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () { };

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    moment.lang = deprecate(
        'moment.lang is deprecated. Use moment.locale instead.',
        function (key, value) {
            return moment.locale(key, value);
        }
    );

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    moment.locale = function (key, values) {
        var data;
        if (key) {
            if (typeof (values) !== 'undefined') {
                data = moment.defineLocale(key, values);
            }
            else {
                data = moment.localeData(key);
            }

            if (data) {
                moment.duration._locale = moment._locale = data;
            }
        }

        return moment._locale._abbr;
    };

    moment.defineLocale = function (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            moment.locale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    };

    moment.langData = deprecate(
        'moment.langData is deprecated. Use moment.localeData instead.',
        function (key) {
            return moment.localeData(key);
        }
    );

    // returns locale data
    moment.localeData = function (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return moment._locale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null && hasOwnProp(obj, '_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    moment.isDate = isDate;

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone: function () {
            return moment(this);
        },

        valueOf: function () {
            return +this._d - ((this._offset || 0) * 60000);
        },

        unix: function () {
            return Math.floor(+this / 1000);
        },

        toString: function () {
            return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
        },

        toDate: function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString: function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                if ('function' === typeof Date.prototype.toISOString) {
                    // native implementation is ~50x faster, use it when we can
                    return this.toDate().toISOString();
                } else {
                    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                }
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray: function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid: function () {
            return isValid(this);
        },

        isDSTShifted: function () {
            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags: function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc: function (keepLocalTime) {
            return this.utcOffset(0, keepLocalTime);
        },

        local: function (keepLocalTime) {
            if (this._isUTC) {
                this.utcOffset(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.subtract(this._dateUtcOffset(), 'm');
                }
            }
            return this;
        },

        format: function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.localeData().postformat(output);
        },

        add: createAdder(1, 'add'),

        subtract: createAdder(-1, 'subtract'),

        diff: function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (that.utcOffset() - this.utcOffset()) * 6e4,
                anchor, diff, output, daysAdjust;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month' || units === 'quarter') {
                output = monthDiff(this, that);
                if (units === 'quarter') {
                    output = output / 3;
                } else if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = this - that;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from: function (time, withoutSuffix) {
            return moment.duration({ to: this, from: time }).locale(this.locale()).humanize(!withoutSuffix);
        },

        fromNow: function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar: function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're locat/utc/offset
            // or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.localeData().calendar(format, this, moment(now)));
        },

        isLeapYear: function () {
            return isLeapYear(this.year());
        },

        isDST: function () {
            return (this.utcOffset() > this.clone().month(0).utcOffset() ||
                this.utcOffset() > this.clone().month(5).utcOffset());
        },

        day: function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        },

        month: makeAccessor('Month', true),

        startOf: function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
                case 'year':
                    this.month(0);
                    /* falls through */
                case 'quarter':
                case 'month':
                    this.date(1);
                    /* falls through */
                case 'week':
                case 'isoWeek':
                case 'day':
                    this.hours(0);
                    /* falls through */
                case 'hour':
                    this.minutes(0);
                    /* falls through */
                case 'minute':
                    this.seconds(0);
                    /* falls through */
                case 'second':
                    this.milliseconds(0);
                    /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond') {
                return this;
            }
            return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
        },

        isAfter: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this > +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return inputMs < +this.clone().startOf(units);
            }
        },

        isBefore: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this < +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return +this.clone().endOf(units) < inputMs;
            }
        },

        isBetween: function (from, to, units) {
            return this.isAfter(from, units) && this.isBefore(to, units);
        },

        isSame: function (input, units) {
            var inputMs;
            units = normalizeUnits(units || 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this === +input;
            } else {
                inputMs = +moment(input);
                return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
            }
        },

        min: deprecate(
                 'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        zone: deprecate(
                'moment().zone is deprecated, use moment().utcOffset instead. ' +
                'https://github.com/moment/moment/issues/1779',
                function (input, keepLocalTime) {
                    if (input != null) {
                        if (typeof input !== 'string') {
                            input = -input;
                        }

                        this.utcOffset(input, keepLocalTime);

                        return this;
                    } else {
                        return -this.utcOffset();
                    }
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        utcOffset: function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === 'string') {
                    input = utcOffsetFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._dateUtcOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.add(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(input - offset, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }

                return this;
            } else {
                return this._isUTC ? offset : this._dateUtcOffset();
            }
        },

        isLocal: function () {
            return !this._isUTC;
        },

        isUtcOffset: function () {
            return this._isUTC;
        },

        isUtc: function () {
            return this._isUTC && this._offset === 0;
        },

        zoneAbbr: function () {
            return this._isUTC ? 'UTC' : '';
        },

        zoneName: function () {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        },

        parseZone: function () {
            if (this._tzm) {
                this.utcOffset(this._tzm);
            } else if (typeof this._i === 'string') {
                this.utcOffset(utcOffsetFromString(this._i));
            }
            return this;
        },

        hasAlignedHourOffset: function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).utcOffset();
            }

            return (this.utcOffset() - input) % 60 === 0;
        },

        daysInMonth: function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear: function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
        },

        quarter: function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear: function (input) {
            var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        isoWeekYear: function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        week: function (input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        isoWeek: function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        weekday: function (input) {
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        },

        isoWeekday: function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear: function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear: function () {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get: function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set: function (units, value) {
            var unit;
            if (typeof units === 'object') {
                for (unit in units) {
                    this.set(unit, units[unit]);
                }
            }
            else {
                units = normalizeUnits(units);
                if (typeof this[units] === 'function') {
                    this[units](value);
                }
            }
            return this;
        },

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        locale: function (key) {
            var newLocaleData;

            if (key === undefined) {
                return this._locale._abbr;
            } else {
                newLocaleData = moment.localeData(key);
                if (newLocaleData != null) {
                    this._locale = newLocaleData;
                }
                return this;
            }
        },

        lang: deprecate(
            'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    return this.locale(key);
                }
            }
        ),

        localeData: function () {
            return this._locale;
        },

        _dateUtcOffset: function () {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(this._d.getTimezoneOffset() / 15) * 15;
        }

    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate('dates accessor is deprecated. Use date instead.', makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate('years accessor is deprecated. Use year instead.', makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    // alias isUtc for dev-friendliness
    moment.fn.isUTC = moment.fn.isUtc;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears(days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays(years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble: function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs: function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks: function () {
            return absRound(this.days() / 7);
        },

        valueOf: function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize: function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.localeData());

            if (withSuffix) {
                output = this.localeData().pastFuture(+this, output);
            }

            return this.localeData().postformat(output);
        },

        add: function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract: function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get: function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as: function (units) {
            var days, months;
            units = normalizeUnits(units);

            if (units === 'month' || units === 'year') {
                days = this._days + this._milliseconds / 864e5;
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                // handle milliseconds separately because of floating point math errors (issue #1867)
                days = this._days + Math.round(yearsToDays(this._months / 12));
                switch (units) {
                    case 'week': return days / 7 + this._milliseconds / 6048e5;
                    case 'day': return days + this._milliseconds / 864e5;
                    case 'hour': return days * 24 + this._milliseconds / 36e5;
                    case 'minute': return days * 24 * 60 + this._milliseconds / 6e4;
                    case 'second': return days * 24 * 60 * 60 + this._milliseconds / 1000;
                        // Math.floor prevents floating point math errors here
                    case 'millisecond': return Math.floor(days * 24 * 60 * 60 * 1000) + this._milliseconds;
                    default: throw new Error('Unknown unit ' + units);
                }
            }
        },

        lang: moment.fn.lang,
        locale: moment.fn.locale,

        toIsoString: deprecate(
            'toIsoString() is deprecated. Please use toISOString() instead ' +
            '(notice the capitals)',
            function () {
                return this.toISOString();
            }
        ),

        toISOString: function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        },

        localeData: function () {
            return this._locale;
        },

        toJSON: function () {
            return this.toISOString();
        }
    });

    moment.duration.fn.toString = moment.duration.fn.toISOString;

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (hasOwnProp(unitMillisecondFactors, i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Locale
    ************************************/


    // Set default locale, other locale will inherit from English.
    moment.locale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal: function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // moment.js locale configuration
    // locale : afrikaans (af)
    // author : Werner Mollentze : https://github.com/wernerm

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('af', {
            months: 'Januarie_Februarie_Maart_April_Mei_Junie_Julie_Augustus_September_Oktober_November_Desember'.split('_'),
            monthsShort: 'Jan_Feb_Mar_Apr_Mei_Jun_Jul_Aug_Sep_Okt_Nov_Des'.split('_'),
            weekdays: 'Sondag_Maandag_Dinsdag_Woensdag_Donderdag_Vrydag_Saterdag'.split('_'),
            weekdaysShort: 'Son_Maa_Din_Woe_Don_Vry_Sat'.split('_'),
            weekdaysMin: 'So_Ma_Di_Wo_Do_Vr_Sa'.split('_'),
            meridiemParse: /vm|nm/i,
            isPM: function (input) {
                return /^nm$/i.test(input);
            },
            meridiem: function (hours, minutes, isLower) {
                if (hours < 12) {
                    return isLower ? 'vm' : 'VM';
                } else {
                    return isLower ? 'nm' : 'NM';
                }
            },
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Vandag om] LT',
                nextDay: '[Môre om] LT',
                nextWeek: 'dddd [om] LT',
                lastDay: '[Gister om] LT',
                lastWeek: '[Laas] dddd [om] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'oor %s',
                past: '%s gelede',
                s: '\'n paar sekondes',
                m: '\'n minuut',
                mm: '%d minute',
                h: '\'n uur',
                hh: '%d ure',
                d: '\'n dag',
                dd: '%d dae',
                M: '\'n maand',
                MM: '%d maande',
                y: '\'n jaar',
                yy: '%d jaar'
            },
            ordinalParse: /\d{1,2}(ste|de)/,
            ordinal: function (number) {
                return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de'); // Thanks to Joris Röling : https://github.com/jjupiter
            },
            week: {
                dow: 1, // Maandag is die eerste dag van die week.
                doy: 4  // Die week wat die 4de Januarie bevat is die eerste week van die jaar.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Moroccan Arabic (ar-ma)
    // author : ElFadili Yassine : https://github.com/ElFadiliY
    // author : Abdel Said : https://github.com/abdelsaid

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ar-ma', {
            months: 'يناير_فبراير_مارس_أبريل_ماي_يونيو_يوليوز_غشت_شتنبر_أكتوبر_نونبر_دجنبر'.split('_'),
            monthsShort: 'يناير_فبراير_مارس_أبريل_ماي_يونيو_يوليوز_غشت_شتنبر_أكتوبر_نونبر_دجنبر'.split('_'),
            weekdays: 'الأحد_الإتنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
            weekdaysShort: 'احد_اتنين_ثلاثاء_اربعاء_خميس_جمعة_سبت'.split('_'),
            weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[اليوم على الساعة] LT',
                nextDay: '[غدا على الساعة] LT',
                nextWeek: 'dddd [على الساعة] LT',
                lastDay: '[أمس على الساعة] LT',
                lastWeek: 'dddd [على الساعة] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'في %s',
                past: 'منذ %s',
                s: 'ثوان',
                m: 'دقيقة',
                mm: '%d دقائق',
                h: 'ساعة',
                hh: '%d ساعات',
                d: 'يوم',
                dd: '%d أيام',
                M: 'شهر',
                MM: '%d أشهر',
                y: 'سنة',
                yy: '%d سنوات'
            },
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Arabic Saudi Arabia (ar-sa)
    // author : Suhail Alkowaileet : https://github.com/xsoh

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '١',
            '2': '٢',
            '3': '٣',
            '4': '٤',
            '5': '٥',
            '6': '٦',
            '7': '٧',
            '8': '٨',
            '9': '٩',
            '0': '� '
        }, numberMap = {
            '١': '1',
            '٢': '2',
            '٣': '3',
            '٤': '4',
            '٥': '5',
            '٦': '6',
            '٧': '7',
            '٨': '8',
            '٩': '9',
            '� ': '0'
        };

        return moment.defineLocale('ar-sa', {
            months: 'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
            monthsShort: 'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
            weekdays: 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
            weekdaysShort: 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
            weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            meridiemParse: /ص|م/,
            isPM: function (input) {
                return 'م' === input;
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 12) {
                    return 'ص';
                } else {
                    return 'م';
                }
            },
            calendar: {
                sameDay: '[اليوم على الساعة] LT',
                nextDay: '[غدا على الساعة] LT',
                nextWeek: 'dddd [على الساعة] LT',
                lastDay: '[أمس على الساعة] LT',
                lastWeek: 'dddd [على الساعة] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'في %s',
                past: 'منذ %s',
                s: 'ثوان',
                m: 'دقيقة',
                mm: '%d دقائق',
                h: 'ساعة',
                hh: '%d ساعات',
                d: 'يوم',
                dd: '%d أيام',
                M: 'شهر',
                MM: '%d أشهر',
                y: 'سنة',
                yy: '%d سنوات'
            },
            preparse: function (string) {
                return string.replace(/[١٢٣٤٥٦٧٨٩� ]/g, function (match) {
                    return numberMap[match];
                }).replace(/،/g, ',');
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                }).replace(/,/g, '،');
            },
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale  : Tunisian Arabic (ar-tn)

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ar-tn', {
            months: 'جانفي_فيفري_مارس_أفريل_ماي_جوان_جويلية_أوت_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
            monthsShort: 'جانفي_فيفري_مارس_أفريل_ماي_جوان_جويلية_أوت_سبتمبر_أكتوبر_نوفمبر_ديسمبر'.split('_'),
            weekdays: 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
            weekdaysShort: 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
            weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[اليوم على الساعة] LT',
                nextDay: '[غدا على الساعة] LT',
                nextWeek: 'dddd [على الساعة] LT',
                lastDay: '[أمس على الساعة] LT',
                lastWeek: 'dddd [على الساعة] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'في %s',
                past: 'منذ %s',
                s: 'ثوان',
                m: 'دقيقة',
                mm: '%d دقائق',
                h: 'ساعة',
                hh: '%d ساعات',
                d: 'يوم',
                dd: '%d أيام',
                M: 'شهر',
                MM: '%d أشهر',
                y: 'سنة',
                yy: '%d سنوات'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4 // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // Locale: Arabic (ar)
    // Author: Abdel Said: https://github.com/abdelsaid
    // Changes in months, weekdays: Ahmed Elkhatib
    // Native plural forms: forabi https://github.com/forabi

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '١',
            '2': '٢',
            '3': '٣',
            '4': '٤',
            '5': '٥',
            '6': '٦',
            '7': '٧',
            '8': '٨',
            '9': '٩',
            '0': '� '
        }, numberMap = {
            '١': '1',
            '٢': '2',
            '٣': '3',
            '٤': '4',
            '٥': '5',
            '٦': '6',
            '٧': '7',
            '٨': '8',
            '٩': '9',
            '� ': '0'
        }, pluralForm = function (n) {
            return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5;
        }, plurals = {
            s: ['أقل من ثانية', 'ثانية واحدة', ['ثانيتان', 'ثانيتين'], '%d ثوان', '%d ثانية', '%d ثانية'],
            m: ['أقل من دقيقة', 'دقيقة واحدة', ['دقيقتان', 'دقيقتين'], '%d دقائق', '%d دقيقة', '%d دقيقة'],
            h: ['أقل من ساعة', 'ساعة واحدة', ['ساعتان', 'ساعتين'], '%d ساعات', '%d ساعة', '%d ساعة'],
            d: ['أقل من يوم', 'يوم واحد', ['يومان', 'يومين'], '%d أيام', '%d يومًا', '%d يوم'],
            M: ['أقل من شهر', 'شهر واحد', ['شهران', 'شهرين'], '%d أشهر', '%d شهرا', '%d شهر'],
            y: ['أقل من عام', 'عام واحد', ['عامان', 'عامين'], '%d أعوام', '%d عامًا', '%d عام']
        }, pluralize = function (u) {
            return function (number, withoutSuffix, string, isFuture) {
                var f = pluralForm(number),
                    str = plurals[u][pluralForm(number)];
                if (f === 2) {
                    str = str[withoutSuffix ? 0 : 1];
                }
                return str.replace(/%d/i, number);
            };
        }, months = [
            'كانون الثاني يناير',
            'شباط فبراير',
            'آذار مارس',
            'نيسان أبريل',
            'أيار مايو',
            'حزيران يونيو',
            'تموز يوليو',
            'آب أغسطس',
            'أيلول سبتمبر',
            'تشرين الأول أكتوبر',
            'تشرين الثاني نوفمبر',
            'كانون الأول ديسمبر'
        ];

        return moment.defineLocale('ar', {
            months: months,
            monthsShort: months,
            weekdays: 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
            weekdaysShort: 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
            weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            meridiemParse: /ص|م/,
            isPM: function (input) {
                return 'م' === input;
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 12) {
                    return 'ص';
                } else {
                    return 'م';
                }
            },
            calendar: {
                sameDay: '[اليوم عند الساعة] LT',
                nextDay: '[غدًا عند الساعة] LT',
                nextWeek: 'dddd [عند الساعة] LT',
                lastDay: '[أمس عند الساعة] LT',
                lastWeek: 'dddd [عند الساعة] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'بعد %s',
                past: 'منذ %s',
                s: pluralize('s'),
                m: pluralize('m'),
                mm: pluralize('m'),
                h: pluralize('h'),
                hh: pluralize('h'),
                d: pluralize('d'),
                dd: pluralize('d'),
                M: pluralize('M'),
                MM: pluralize('M'),
                y: pluralize('y'),
                yy: pluralize('y')
            },
            preparse: function (string) {
                return string.replace(/[١٢٣٤٥٦٧٨٩� ]/g, function (match) {
                    return numberMap[match];
                }).replace(/،/g, ',');
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                }).replace(/,/g, '،');
            },
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : azerbaijani (az)
    // author : topchiyev : https://github.com/topchiyev

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var suffixes = {
            1: '-inci',
            5: '-inci',
            8: '-inci',
            70: '-inci',
            80: '-inci',

            2: '-nci',
            7: '-nci',
            20: '-nci',
            50: '-nci',

            3: '-üncü',
            4: '-üncü',
            100: '-üncü',

            6: '-ncı',

            9: '-uncu',
            10: '-uncu',
            30: '-uncu',

            60: '-ıncı',
            90: '-ıncı'
        };
        return moment.defineLocale('az', {
            months: 'yanvar_fevral_mart_aprel_may_iyun_iyul_avqust_sentyabr_oktyabr_noyabr_dekabr'.split('_'),
            monthsShort: 'yan_fev_mar_apr_may_iyn_iyl_avq_sen_okt_noy_dek'.split('_'),
            weekdays: 'Bazar_Bazar ertəsi_Çərşənbə axşamı_Çərşənbə_Cümə axşamı_Cümə_Şənbə'.split('_'),
            weekdaysShort: 'Baz_BzE_ÇAx_Çər_CAx_Cüm_Şən'.split('_'),
            weekdaysMin: 'Bz_BE_ÇA_Çə_CA_Cü_Şə'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[bugün saat] LT',
                nextDay: '[sabah saat] LT',
                nextWeek: '[gələn həftə] dddd [saat] LT',
                lastDay: '[dünən] LT',
                lastWeek: '[keçən həftə] dddd [saat] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s sonra',
                past: '%s əvvəl',
                s: 'birneçə saniyyə',
                m: 'bir dəqiqə',
                mm: '%d dəqiqə',
                h: 'bir saat',
                hh: '%d saat',
                d: 'bir gün',
                dd: '%d gün',
                M: 'bir ay',
                MM: '%d ay',
                y: 'bir il',
                yy: '%d il'
            },
            meridiemParse: /gecə|səhər|gündüz|axşam/,
            isPM: function (input) {
                return /^(gündüz|axşam)$/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'gecə';
                } else if (hour < 12) {
                    return 'səhər';
                } else if (hour < 17) {
                    return 'gündüz';
                } else {
                    return 'axşam';
                }
            },
            ordinalParse: /\d{1,2}-(ıncı|inci|nci|üncü|ncı|uncu)/,
            ordinal: function (number) {
                if (number === 0) {  // special case for zero
                    return number + '-ıncı';
                }
                var a = number % 10,
                    b = number % 100 - a,
                    c = number >= 100 ? 100 : null;

                return number + (suffixes[a] || suffixes[b] || suffixes[c]);
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : belarusian (be)
    // author : Dmitry Demidov : https://github.com/demidov91
    // author: Praleska: http://praleska.pro/
    // Author : Menelion Elensúle : https://github.com/Oire

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function plural(word, num) {
            var forms = word.split('_');
            return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
        }

        function relativeTimeWithPlural(number, withoutSuffix, key) {
            var format = {
                'mm': withoutSuffix ? 'хвіліна_хвіліны_хвілін' : 'хвіліну_хвіліны_хвілін',
                'hh': withoutSuffix ? 'гадзіна_гадзіны_гадзін' : 'гадзіну_гадзіны_гадзін',
                'dd': 'дзень_дні_дзён',
                'MM': 'месяц_месяцы_месяцаў',
                'yy': 'год_гады_гадоў'
            };
            if (key === 'm') {
                return withoutSuffix ? 'хвіліна' : 'хвіліну';
            }
            else if (key === 'h') {
                return withoutSuffix ? 'гадзіна' : 'гадзіну';
            }
            else {
                return number + ' ' + plural(format[key], +number);
            }
        }

        function monthsCaseReplace(m, format) {
            var months = {
                'nominative': 'студзень_люты_сакавік_красавік_травень_чэрвень_ліпень_жнівень_верасень_кастрычнік_лістапад_снежань'.split('_'),
                'accusative': 'студзеня_лютага_сакавіка_красавіка_траўня_чэрвеня_ліпеня_жніўня_верасня_кастрычніка_лістапада_снежня'.split('_')
            },

            nounCase = (/D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return months[nounCase][m.month()];
        }

        function weekdaysCaseReplace(m, format) {
            var weekdays = {
                'nominative': 'нядзеля_панядзелак_аўторак_серада_чацвер_пятніца_субота'.split('_'),
                'accusative': 'нядзелю_панядзелак_аўторак_сераду_чацвер_пятніцу_суботу'.split('_')
            },

            nounCase = (/\[ ?[Вв] ?(?:мінулую|наступную)? ?\] ?dddd/).test(format) ?
                'accusative' :
                'nominative';

            return weekdays[nounCase][m.day()];
        }

        return moment.defineLocale('be', {
            months: monthsCaseReplace,
            monthsShort: 'студ_лют_сак_крас_трав_чэрв_ліп_жнів_вер_каст_ліст_снеж'.split('_'),
            weekdays: weekdaysCaseReplace,
            weekdaysShort: 'нд_пн_ат_ср_чц_пт_сб'.split('_'),
            weekdaysMin: 'нд_пн_ат_ср_чц_пт_сб'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY г.',
                LLL: 'D MMMM YYYY г., LT',
                LLLL: 'dddd, D MMMM YYYY г., LT'
            },
            calendar: {
                sameDay: '[Сёння ў] LT',
                nextDay: '[Заўтра ў] LT',
                lastDay: '[Учора ў] LT',
                nextWeek: function () {
                    return '[У] dddd [ў] LT';
                },
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                        case 5:
                        case 6:
                            return '[У мінулую] dddd [ў] LT';
                        case 1:
                        case 2:
                        case 4:
                            return '[У мінулы] dddd [ў] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'праз %s',
                past: '%s таму',
                s: 'некалькі секунд',
                m: relativeTimeWithPlural,
                mm: relativeTimeWithPlural,
                h: relativeTimeWithPlural,
                hh: relativeTimeWithPlural,
                d: 'дзень',
                dd: relativeTimeWithPlural,
                M: 'месяц',
                MM: relativeTimeWithPlural,
                y: 'год',
                yy: relativeTimeWithPlural
            },
            meridiemParse: /ночы|раніцы|дня|вечара/,
            isPM: function (input) {
                return /^(дня|вечара)$/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'ночы';
                } else if (hour < 12) {
                    return 'раніцы';
                } else if (hour < 17) {
                    return 'дня';
                } else {
                    return 'вечара';
                }
            },

            ordinalParse: /\d{1,2}-(і|ы|га)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'M':
                    case 'd':
                    case 'DDD':
                    case 'w':
                    case 'W':
                        return (number % 10 === 2 || number % 10 === 3) && (number % 100 !== 12 && number % 100 !== 13) ? number + '-і' : number + '-ы';
                    case 'D':
                        return number + '-га';
                    default:
                        return number;
                }
            },

            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : bulgarian (bg)
    // author : Krasen Borisov : https://github.com/kraz

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('bg', {
            months: 'януари_февруари_март_април_май_юни_юли_август_септември_октомври_ноември_декември'.split('_'),
            monthsShort: 'янр_фев_мар_апр_май_юни_юли_авг_сеп_окт_ное_дек'.split('_'),
            weekdays: 'неделя_понеделник_вторник_сряда_четвъртък_петък_събота'.split('_'),
            weekdaysShort: 'нед_пон_вто_сря_чет_пет_съб'.split('_'),
            weekdaysMin: 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'D.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Днес в] LT',
                nextDay: '[Утре в] LT',
                nextWeek: 'dddd [в] LT',
                lastDay: '[Вчера в] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                        case 6:
                            return '[В изминалата] dddd [в] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[В изминалия] dddd [в] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'след %s',
                past: 'преди %s',
                s: 'няколко секунди',
                m: 'минута',
                mm: '%d минути',
                h: 'час',
                hh: '%d часа',
                d: 'ден',
                dd: '%d дни',
                M: 'месец',
                MM: '%d месеца',
                y: 'година',
                yy: '%d години'
            },
            ordinalParse: /\d{1,2}-(ев|ен|ти|ви|ри|ми)/,
            ordinal: function (number) {
                var lastDigit = number % 10,
                    last2Digits = number % 100;
                if (number === 0) {
                    return number + '-ев';
                } else if (last2Digits === 0) {
                    return number + '-ен';
                } else if (last2Digits > 10 && last2Digits < 20) {
                    return number + '-ти';
                } else if (lastDigit === 1) {
                    return number + '-ви';
                } else if (lastDigit === 2) {
                    return number + '-ри';
                } else if (lastDigit === 7 || lastDigit === 8) {
                    return number + '-ми';
                } else {
                    return number + '-ти';
                }
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Bengali (bn)
    // author : Kaushik Gandhi : https://github.com/kaushikgandhi

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '১',
            '2': '২',
            '3': '৩',
            '4': '৪',
            '5': '৫',
            '6': '৬',
            '7': '৭',
            '8': '৮',
            '9': '৯',
            '0': '০'
        },
        numberMap = {
            '১': '1',
            '২': '2',
            '৩': '3',
            '৪': '4',
            '৫': '5',
            '৬': '6',
            '৭': '7',
            '৮': '8',
            '৯': '9',
            '০': '0'
        };

        return moment.defineLocale('bn', {
            months: 'জানুয়ারী_ফেবুয়ারী_মার্চ_এপ্রিল_মে_জুন_জুলাই_অগাস্ট_সেপ্টেম্বর_অক্টোবর_নভেম্বর_ডিসেম্বর'.split('_'),
            monthsShort: 'জানু_ফেব_মার্চ_এপর_মে_জুন_জুল_অগ_সেপ্ট_অক্টো_নভ_ডিসেম্'.split('_'),
            weekdays: 'রবিবার_সোমবার_মঙ্গলবার_বুধবার_বৃহস্পত্তিবার_শুক্রুবার_শনিবার'.split('_'),
            weekdaysShort: 'রবি_সোম_মঙ্গল_বুধ_বৃহস্পত্তি_শুক্রু_শনি'.split('_'),
            weekdaysMin: 'রব_সম_মঙ্গ_বু_ব্রিহ_শু_শনি'.split('_'),
            longDateFormat: {
                LT: 'A h:mm সময়',
                LTS: 'A h:mm:ss সময়',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[আজ] LT',
                nextDay: '[আগামীকাল] LT',
                nextWeek: 'dddd, LT',
                lastDay: '[গতকাল] LT',
                lastWeek: '[গত] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s পরে',
                past: '%s আগে',
                s: 'কএক সেকেন্ড',
                m: 'এক মিনিট',
                mm: '%d মিনিট',
                h: 'এক ঘন্টা',
                hh: '%d ঘন্টা',
                d: 'এক দিন',
                dd: '%d দিন',
                M: 'এক মাস',
                MM: '%d মাস',
                y: 'এক বছর',
                yy: '%d বছর'
            },
            preparse: function (string) {
                return string.replace(/[১২৩৪৫৬৭৮৯০]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            meridiemParse: /রাত|শকাল|দুপুর|বিকেল|রাত/,
            isPM: function (input) {
                return /^(দুপুর|বিকেল|রাত)$/.test(input);
            },
            //Bengali is a vast language its spoken
            //in different forms in various parts of the world.
            //I have just generalized with most common one used
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'রাত';
                } else if (hour < 10) {
                    return 'শকাল';
                } else if (hour < 17) {
                    return 'দুপুর';
                } else if (hour < 20) {
                    return 'বিকেল';
                } else {
                    return 'রাত';
                }
            },
            week: {
                dow: 0, // Sunday is the first day of the week.
                doy: 6  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : tibetan (bo)
    // author : Thupten N. Chakrishar : https://github.com/vajradog

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '༡',
            '2': '༢',
            '3': '༣',
            '4': '༤',
            '5': '༥',
            '6': '༦',
            '7': '༧',
            '8': '༨',
            '9': '༩',
            '0': '� '
        },
        numberMap = {
            '༡': '1',
            '༢': '2',
            '༣': '3',
            '༤': '4',
            '༥': '5',
            '༦': '6',
            '༧': '7',
            '༨': '8',
            '༩': '9',
            '� ': '0'
        };

        return moment.defineLocale('bo', {
            months: 'ཟླ་བ་དང་པོ_ཟླ་བ་གཉིས་པ_ཟླ་བ་གསུམ་པ_ཟླ་བ་བཞི་པ_ཟླ་བ་ལྔ་པ_ཟླ་བ་དྲུག་པ_ཟླ་བ་བདུན་པ_ཟླ་བ་བརྒྱད་པ_ཟླ་བ་དགུ་པ_ཟླ་བ་བཅུ་པ_ཟླ་བ་བཅུ་གཅིག་པ_ཟླ་བ་བཅུ་གཉིས་པ'.split('_'),
            monthsShort: 'ཟླ་བ་དང་པོ_ཟླ་བ་གཉིས་པ_ཟླ་བ་གསུམ་པ_ཟླ་བ་བཞི་པ_ཟླ་བ་ལྔ་པ_ཟླ་བ་དྲུག་པ_ཟླ་བ་བདུན་པ_ཟླ་བ་བརྒྱད་པ_ཟླ་བ་དགུ་པ_ཟླ་བ་བཅུ་པ_ཟླ་བ་བཅུ་གཅིག་པ_ཟླ་བ་བཅུ་གཉིས་པ'.split('_'),
            weekdays: 'གཟ� ་ཉི་མ་_གཟ� ་ཟླ་བ་_གཟ� ་མིག་དམར་_གཟ� ་ལྷག་པ་_གཟ� ་ཕུར་བུ_གཟ� ་པ་སངས་_གཟ� ་སྤེན་པ་'.split('_'),
            weekdaysShort: 'ཉི་མ་_ཟླ་བ་_མིག་དམར་_ལྷག་པ་_ཕུར་བུ_པ་སངས་_སྤེན་པ་'.split('_'),
            weekdaysMin: 'ཉི་མ་_ཟླ་བ་_མིག་དམར་_ལྷག་པ་_ཕུར་བུ_པ་སངས་_སྤེན་པ་'.split('_'),
            longDateFormat: {
                LT: 'A h:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[དི་རིང] LT',
                nextDay: '[སང་ཉིན] LT',
                nextWeek: '[བདུན་ཕྲག་རྗེས་མ], LT',
                lastDay: '[ཁ་སང] LT',
                lastWeek: '[བདུན་ཕྲག་མཐ� ་མ] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s ལ་',
                past: '%s སྔན་ལ',
                s: 'ལམ་སང',
                m: 'སྐར་མ་གཅིག',
                mm: '%d སྐར་མ',
                h: 'ཆུ་ཚོད་གཅིག',
                hh: '%d ཆུ་ཚོད',
                d: 'ཉིན་གཅིག',
                dd: '%d ཉིན་',
                M: 'ཟླ་བ་གཅིག',
                MM: '%d ཟླ་བ',
                y: 'ལོ་གཅིག',
                yy: '%d ལོ'
            },
            preparse: function (string) {
                return string.replace(/[༡༢༣༤༥༦༧༨༩� ]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            meridiemParse: /མཚན་མོ|ཞོགས་ཀས|ཉིན་གུང|དགོང་དག|མཚན་མོ/,
            isPM: function (input) {
                return /^(ཉིན་གུང|དགོང་དག|མཚན་མོ)$/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'མཚན་མོ';
                } else if (hour < 10) {
                    return 'ཞོགས་ཀས';
                } else if (hour < 17) {
                    return 'ཉིན་གུང';
                } else if (hour < 20) {
                    return 'དགོང་དག';
                } else {
                    return 'མཚན་མོ';
                }
            },
            week: {
                dow: 0, // Sunday is the first day of the week.
                doy: 6  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : breton (br)
    // author : Jean-Baptiste Le Duigou : https://github.com/jbleduigou

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function relativeTimeWithMutation(number, withoutSuffix, key) {
            var format = {
                'mm': 'munutenn',
                'MM': 'miz',
                'dd': 'devezh'
            };
            return number + ' ' + mutation(format[key], number);
        }

        function specialMutationForYears(number) {
            switch (lastNumber(number)) {
                case 1:
                case 3:
                case 4:
                case 5:
                case 9:
                    return number + ' bloaz';
                default:
                    return number + ' vloaz';
            }
        }

        function lastNumber(number) {
            if (number > 9) {
                return lastNumber(number % 10);
            }
            return number;
        }

        function mutation(text, number) {
            if (number === 2) {
                return softMutation(text);
            }
            return text;
        }

        function softMutation(text) {
            var mutationTable = {
                'm': 'v',
                'b': 'v',
                'd': 'z'
            };
            if (mutationTable[text.charAt(0)] === undefined) {
                return text;
            }
            return mutationTable[text.charAt(0)] + text.substring(1);
        }

        return moment.defineLocale('br', {
            months: 'Genver_C\'hwevrer_Meurzh_Ebrel_Mae_Mezheven_Gouere_Eost_Gwengolo_Here_Du_Kerzu'.split('_'),
            monthsShort: 'Gen_C\'hwe_Meu_Ebr_Mae_Eve_Gou_Eos_Gwe_Her_Du_Ker'.split('_'),
            weekdays: 'Sul_Lun_Meurzh_Merc\'her_Yaou_Gwener_Sadorn'.split('_'),
            weekdaysShort: 'Sul_Lun_Meu_Mer_Yao_Gwe_Sad'.split('_'),
            weekdaysMin: 'Su_Lu_Me_Mer_Ya_Gw_Sa'.split('_'),
            longDateFormat: {
                LT: 'h[e]mm A',
                LTS: 'h[e]mm:ss A',
                L: 'DD/MM/YYYY',
                LL: 'D [a viz] MMMM YYYY',
                LLL: 'D [a viz] MMMM YYYY LT',
                LLLL: 'dddd, D [a viz] MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Hiziv da] LT',
                nextDay: '[Warc\'hoazh da] LT',
                nextWeek: 'dddd [da] LT',
                lastDay: '[Dec\'h da] LT',
                lastWeek: 'dddd [paset da] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'a-benn %s',
                past: '%s \'zo',
                s: 'un nebeud segondennoù',
                m: 'ur vunutenn',
                mm: relativeTimeWithMutation,
                h: 'un eur',
                hh: '%d eur',
                d: 'un devezh',
                dd: relativeTimeWithMutation,
                M: 'ur miz',
                MM: relativeTimeWithMutation,
                y: 'ur bloaz',
                yy: specialMutationForYears
            },
            ordinalParse: /\d{1,2}(añ|vet)/,
            ordinal: function (number) {
                var output = (number === 1) ? 'añ' : 'vet';
                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : bosnian (bs)
    // author : Nedim Cholich : https://github.com/frontyard
    // based on (hr) translation by Bojan Marković

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function translate(number, withoutSuffix, key) {
            var result = number + ' ';
            switch (key) {
                case 'm':
                    return withoutSuffix ? 'jedna minuta' : 'jedne minute';
                case 'mm':
                    if (number === 1) {
                        result += 'minuta';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'minute';
                    } else {
                        result += 'minuta';
                    }
                    return result;
                case 'h':
                    return withoutSuffix ? 'jedan sat' : 'jednog sata';
                case 'hh':
                    if (number === 1) {
                        result += 'sat';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'sata';
                    } else {
                        result += 'sati';
                    }
                    return result;
                case 'dd':
                    if (number === 1) {
                        result += 'dan';
                    } else {
                        result += 'dana';
                    }
                    return result;
                case 'MM':
                    if (number === 1) {
                        result += 'mjesec';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'mjeseca';
                    } else {
                        result += 'mjeseci';
                    }
                    return result;
                case 'yy':
                    if (number === 1) {
                        result += 'godina';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'godine';
                    } else {
                        result += 'godina';
                    }
                    return result;
            }
        }

        return moment.defineLocale('bs', {
            months: 'januar_februar_mart_april_maj_juni_juli_august_septembar_oktobar_novembar_decembar'.split('_'),
            monthsShort: 'jan._feb._mar._apr._maj._jun._jul._aug._sep._okt._nov._dec.'.split('_'),
            weekdays: 'nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota'.split('_'),
            weekdaysShort: 'ned._pon._uto._sri._čet._pet._sub.'.split('_'),
            weekdaysMin: 'ne_po_ut_sr_če_pe_su'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD. MM. YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[danas u] LT',
                nextDay: '[sutra u] LT',

                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[u] [nedjelju] [u] LT';
                        case 3:
                            return '[u] [srijedu] [u] LT';
                        case 6:
                            return '[u] [subotu] [u] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[u] dddd [u] LT';
                    }
                },
                lastDay: '[jučer u] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                            return '[prošlu] dddd [u] LT';
                        case 6:
                            return '[prošle] [subote] [u] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[prošli] dddd [u] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: 'prije %s',
                s: 'par sekundi',
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: 'dan',
                dd: translate,
                M: 'mjesec',
                MM: translate,
                y: 'godinu',
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : catalan (ca)
    // author : Juan G. Hurtado : https://github.com/juanghurtado

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ca', {
            months: 'gener_febrer_març_abril_maig_juny_juliol_agost_setembre_octubre_novembre_desembre'.split('_'),
            monthsShort: 'gen._febr._mar._abr._mai._jun._jul._ag._set._oct._nov._des.'.split('_'),
            weekdays: 'diumenge_dilluns_dimarts_dimecres_dijous_divendres_dissabte'.split('_'),
            weekdaysShort: 'dg._dl._dt._dc._dj._dv._ds.'.split('_'),
            weekdaysMin: 'Dg_Dl_Dt_Dc_Dj_Dv_Ds'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: function () {
                    return '[avui a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
                },
                nextDay: function () {
                    return '[dem�  a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
                },
                nextWeek: function () {
                    return 'dddd [a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
                },
                lastDay: function () {
                    return '[ahir a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
                },
                lastWeek: function () {
                    return '[el] dddd [passat a ' + ((this.hours() !== 1) ? 'les' : 'la') + '] LT';
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'en %s',
                past: 'fa %s',
                s: 'uns segons',
                m: 'un minut',
                mm: '%d minuts',
                h: 'una hora',
                hh: '%d hores',
                d: 'un dia',
                dd: '%d dies',
                M: 'un mes',
                MM: '%d mesos',
                y: 'un any',
                yy: '%d anys'
            },
            ordinalParse: /\d{1,2}(r|n|t|è|a)/,
            ordinal: function (number, period) {
                var output = (number === 1) ? 'r' :
                    (number === 2) ? 'n' :
                    (number === 3) ? 'r' :
                    (number === 4) ? 't' : 'è';
                if (period === 'w' || period === 'W') {
                    output = 'a';
                }
                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : czech (cs)
    // author : petrbela : https://github.com/petrbela

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var months = 'leden_únor_březen_duben_květen_červen_červenec_srpen_září_říjen_listopad_prosinec'.split('_'),
            monthsShort = 'led_úno_bře_dub_kvě_čvn_čvc_srp_zář_říj_lis_pro'.split('_');

        function plural(n) {
            return (n > 1) && (n < 5) && (~~(n / 10) !== 1);
        }

        function translate(number, withoutSuffix, key, isFuture) {
            var result = number + ' ';
            switch (key) {
                case 's':  // a few seconds / in a few seconds / a few seconds ago
                    return (withoutSuffix || isFuture) ? 'pár sekund' : 'pár sekundami';
                case 'm':  // a minute / in a minute / a minute ago
                    return withoutSuffix ? 'minuta' : (isFuture ? 'minutu' : 'minutou');
                case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'minuty' : 'minut');
                    } else {
                        return result + 'minutami';
                    }
                    break;
                case 'h':  // an hour / in an hour / an hour ago
                    return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
                case 'hh': // 9 hours / in 9 hours / 9 hours ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'hodiny' : 'hodin');
                    } else {
                        return result + 'hodinami';
                    }
                    break;
                case 'd':  // a day / in a day / a day ago
                    return (withoutSuffix || isFuture) ? 'den' : 'dnem';
                case 'dd': // 9 days / in 9 days / 9 days ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'dny' : 'dní');
                    } else {
                        return result + 'dny';
                    }
                    break;
                case 'M':  // a month / in a month / a month ago
                    return (withoutSuffix || isFuture) ? 'měsíc' : 'měsícem';
                case 'MM': // 9 months / in 9 months / 9 months ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'měsíce' : 'měsíců');
                    } else {
                        return result + 'měsíci';
                    }
                    break;
                case 'y':  // a year / in a year / a year ago
                    return (withoutSuffix || isFuture) ? 'rok' : 'rokem';
                case 'yy': // 9 years / in 9 years / 9 years ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'roky' : 'let');
                    } else {
                        return result + 'lety';
                    }
                    break;
            }
        }

        return moment.defineLocale('cs', {
            months: months,
            monthsShort: monthsShort,
            monthsParse: (function (months, monthsShort) {
                var i, _monthsParse = [];
                for (i = 0; i < 12; i++) {
                    // use custom parser to solve problem with July (červenec)
                    _monthsParse[i] = new RegExp('^' + months[i] + '$|^' + monthsShort[i] + '$', 'i');
                }
                return _monthsParse;
            }(months, monthsShort)),
            weekdays: 'neděle_pondělí_úterý_středa_čtvrtek_pátek_sobota'.split('_'),
            weekdaysShort: 'ne_po_út_st_čt_pá_so'.split('_'),
            weekdaysMin: 'ne_po_út_st_čt_pá_so'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[dnes v] LT',
                nextDay: '[zítra v] LT',
                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[v neděli v] LT';
                        case 1:
                        case 2:
                            return '[v] dddd [v] LT';
                        case 3:
                            return '[ve středu v] LT';
                        case 4:
                            return '[ve čtvrtek v] LT';
                        case 5:
                            return '[v pátek v] LT';
                        case 6:
                            return '[v sobotu v] LT';
                    }
                },
                lastDay: '[včera v] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[minulou neděli v] LT';
                        case 1:
                        case 2:
                            return '[minulé] dddd [v] LT';
                        case 3:
                            return '[minulou středu v] LT';
                        case 4:
                        case 5:
                            return '[minulý] dddd [v] LT';
                        case 6:
                            return '[minulou sobotu v] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: 'před %s',
                s: translate,
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: translate,
                dd: translate,
                M: translate,
                MM: translate,
                y: translate,
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : chuvash (cv)
    // author : Anatoly Mironov : https://github.com/mirontoli

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('cv', {
            months: 'кăрлач_нарăс_пуш_ака_май_çĕртме_утă_çурла_авăн_юпа_чӳк_раштав'.split('_'),
            monthsShort: 'кăр_нар_пуш_ака_май_çĕр_утă_çур_ав_юпа_чӳк_раш'.split('_'),
            weekdays: 'вырсарникун_тунтикун_ытларикун_юнкун_кĕçнерникун_эрнекун_шăматкун'.split('_'),
            weekdaysShort: 'выр_тун_ытл_юн_кĕç_эрн_шăм'.split('_'),
            weekdaysMin: 'вр_тн_ыт_юн_кç_эр_шм'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD-MM-YYYY',
                LL: 'YYYY [çулхи] MMMM [уйăхĕн] D[-мĕшĕ]',
                LLL: 'YYYY [çулхи] MMMM [уйăхĕн] D[-мĕшĕ], LT',
                LLLL: 'dddd, YYYY [çулхи] MMMM [уйăхĕн] D[-мĕшĕ], LT'
            },
            calendar: {
                sameDay: '[Паян] LT [сехетре]',
                nextDay: '[Ыран] LT [сехетре]',
                lastDay: '[Ĕнер] LT [сехетре]',
                nextWeek: '[Çитес] dddd LT [сехетре]',
                lastWeek: '[Иртнĕ] dddd LT [сехетре]',
                sameElse: 'L'
            },
            relativeTime: {
                future: function (output) {
                    var affix = /сехет$/i.exec(output) ? 'рен' : /çул$/i.exec(output) ? 'тан' : 'ран';
                    return output + affix;
                },
                past: '%s каялла',
                s: 'пĕр-ик çеккунт',
                m: 'пĕр минут',
                mm: '%d минут',
                h: 'пĕр сехет',
                hh: '%d сехет',
                d: 'пĕр кун',
                dd: '%d кун',
                M: 'пĕр уйăх',
                MM: '%d уйăх',
                y: 'пĕр çул',
                yy: '%d çул'
            },
            ordinalParse: /\d{1,2}-мĕш/,
            ordinal: '%d-мĕш',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Welsh (cy)
    // author : Robert Allen

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('cy', {
            months: 'Ionawr_Chwefror_Mawrth_Ebrill_Mai_Mehefin_Gorffennaf_Awst_Medi_Hydref_Tachwedd_Rhagfyr'.split('_'),
            monthsShort: 'Ion_Chwe_Maw_Ebr_Mai_Meh_Gor_Aws_Med_Hyd_Tach_Rhag'.split('_'),
            weekdays: 'Dydd Sul_Dydd Llun_Dydd Mawrth_Dydd Mercher_Dydd Iau_Dydd Gwener_Dydd Sadwrn'.split('_'),
            weekdaysShort: 'Sul_Llun_Maw_Mer_Iau_Gwe_Sad'.split('_'),
            weekdaysMin: 'Su_Ll_Ma_Me_Ia_Gw_Sa'.split('_'),
            // time formats are the same as en-gb
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Heddiw am] LT',
                nextDay: '[Yfory am] LT',
                nextWeek: 'dddd [am] LT',
                lastDay: '[Ddoe am] LT',
                lastWeek: 'dddd [diwethaf am] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'mewn %s',
                past: '%s yn ôl',
                s: 'ychydig eiliadau',
                m: 'munud',
                mm: '%d munud',
                h: 'awr',
                hh: '%d awr',
                d: 'diwrnod',
                dd: '%d diwrnod',
                M: 'mis',
                MM: '%d mis',
                y: 'blwyddyn',
                yy: '%d flynedd'
            },
            ordinalParse: /\d{1,2}(fed|ain|af|il|ydd|ed|eg)/,
            // traditional ordinal numbers above 31 are not commonly used in colloquial Welsh
            ordinal: function (number) {
                var b = number,
                    output = '',
                    lookup = [
                        '', 'af', 'il', 'ydd', 'ydd', 'ed', 'ed', 'ed', 'fed', 'fed', 'fed', // 1af to 10fed
                        'eg', 'fed', 'eg', 'eg', 'fed', 'eg', 'eg', 'fed', 'eg', 'fed' // 11eg to 20fed
                    ];

                if (b > 20) {
                    if (b === 40 || b === 50 || b === 60 || b === 80 || b === 100) {
                        output = 'fed'; // not 30ain, 70ain or 90ain
                    } else {
                        output = 'ain';
                    }
                } else if (b > 0) {
                    output = lookup[b];
                }

                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : danish (da)
    // author : Ulrik Nielsen : https://github.com/mrbase

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('da', {
            months: 'januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december'.split('_'),
            monthsShort: 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
            weekdays: 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
            weekdaysShort: 'søn_man_tir_ons_tor_fre_lør'.split('_'),
            weekdaysMin: 'sø_ma_ti_on_to_fr_lø'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd [d.] D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[I dag kl.] LT',
                nextDay: '[I morgen kl.] LT',
                nextWeek: 'dddd [kl.] LT',
                lastDay: '[I går kl.] LT',
                lastWeek: '[sidste] dddd [kl] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'om %s',
                past: '%s siden',
                s: 'få sekunder',
                m: 'et minut',
                mm: '%d minutter',
                h: 'en time',
                hh: '%d timer',
                d: 'en dag',
                dd: '%d dage',
                M: 'en måned',
                MM: '%d måneder',
                y: 'et år',
                yy: '%d år'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : austrian german (de-at)
    // author : lluchs : https://github.com/lluchs
    // author: Menelion Elensúle: https://github.com/Oire
    // author : Martin Groller : https://github.com/MadMG

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function processRelativeTime(number, withoutSuffix, key, isFuture) {
            var format = {
                'm': ['eine Minute', 'einer Minute'],
                'h': ['eine Stunde', 'einer Stunde'],
                'd': ['ein Tag', 'einem Tag'],
                'dd': [number + ' Tage', number + ' Tagen'],
                'M': ['ein Monat', 'einem Monat'],
                'MM': [number + ' Monate', number + ' Monaten'],
                'y': ['ein Jahr', 'einem Jahr'],
                'yy': [number + ' Jahre', number + ' Jahren']
            };
            return withoutSuffix ? format[key][0] : format[key][1];
        }

        return moment.defineLocale('de-at', {
            months: 'Jänner_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember'.split('_'),
            monthsShort: 'Jän._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.'.split('_'),
            weekdays: 'Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag'.split('_'),
            weekdaysShort: 'So._Mo._Di._Mi._Do._Fr._Sa.'.split('_'),
            weekdaysMin: 'So_Mo_Di_Mi_Do_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Heute um] LT [Uhr]',
                sameElse: 'L',
                nextDay: '[Morgen um] LT [Uhr]',
                nextWeek: 'dddd [um] LT [Uhr]',
                lastDay: '[Gestern um] LT [Uhr]',
                lastWeek: '[letzten] dddd [um] LT [Uhr]'
            },
            relativeTime: {
                future: 'in %s',
                past: 'vor %s',
                s: 'ein paar Sekunden',
                m: processRelativeTime,
                mm: '%d Minuten',
                h: processRelativeTime,
                hh: '%d Stunden',
                d: processRelativeTime,
                dd: processRelativeTime,
                M: processRelativeTime,
                MM: processRelativeTime,
                y: processRelativeTime,
                yy: processRelativeTime
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : german (de)
    // author : lluchs : https://github.com/lluchs
    // author: Menelion Elensúle: https://github.com/Oire

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function processRelativeTime(number, withoutSuffix, key, isFuture) {
            var format = {
                'm': ['eine Minute', 'einer Minute'],
                'h': ['eine Stunde', 'einer Stunde'],
                'd': ['ein Tag', 'einem Tag'],
                'dd': [number + ' Tage', number + ' Tagen'],
                'M': ['ein Monat', 'einem Monat'],
                'MM': [number + ' Monate', number + ' Monaten'],
                'y': ['ein Jahr', 'einem Jahr'],
                'yy': [number + ' Jahre', number + ' Jahren']
            };
            return withoutSuffix ? format[key][0] : format[key][1];
        }

        return moment.defineLocale('de', {
            months: 'Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember'.split('_'),
            monthsShort: 'Jan._Febr._Mrz._Apr._Mai_Jun._Jul._Aug._Sept._Okt._Nov._Dez.'.split('_'),
            weekdays: 'Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag'.split('_'),
            weekdaysShort: 'So._Mo._Di._Mi._Do._Fr._Sa.'.split('_'),
            weekdaysMin: 'So_Mo_Di_Mi_Do_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Heute um] LT [Uhr]',
                sameElse: 'L',
                nextDay: '[Morgen um] LT [Uhr]',
                nextWeek: 'dddd [um] LT [Uhr]',
                lastDay: '[Gestern um] LT [Uhr]',
                lastWeek: '[letzten] dddd [um] LT [Uhr]'
            },
            relativeTime: {
                future: 'in %s',
                past: 'vor %s',
                s: 'ein paar Sekunden',
                m: processRelativeTime,
                mm: '%d Minuten',
                h: processRelativeTime,
                hh: '%d Stunden',
                d: processRelativeTime,
                dd: processRelativeTime,
                M: processRelativeTime,
                MM: processRelativeTime,
                y: processRelativeTime,
                yy: processRelativeTime
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : modern greek (el)
    // author : Aggelos Karalias : https://github.com/mehiel

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('el', {
            monthsNominativeEl: 'Ιανουάριος_Φεβρουάριος_Μάρτιος_Απρίλιος_Μάιος_Ιούνιος_Ιούλιος_Αύγουστος_Σεπτέμβριος_Οκτώβριος_Νοέμβριος_Δεκέμβριος'.split('_'),
            monthsGenitiveEl: 'Ιανουαρίου_Φεβρουαρίου_Μαρτίου_Απριλίου_Μαΐου_Ιουνίου_Ιουλίου_Αυγούστου_Σεπτεμβρίου_Οκτωβρίου_Νοεμβρίου_Δεκεμβρίου'.split('_'),
            months: function (momentToFormat, format) {
                if (/D/.test(format.substring(0, format.indexOf('MMMM')))) { // if there is a day number before 'MMMM'
                    return this._monthsGenitiveEl[momentToFormat.month()];
                } else {
                    return this._monthsNominativeEl[momentToFormat.month()];
                }
            },
            monthsShort: 'Ιαν_Φεβ_Μαρ_Απρ_Μαϊ_Ιουν_Ιουλ_Αυγ_Σεπ_Οκτ_Νοε_Δεκ'.split('_'),
            weekdays: 'Κυριακή_Δευτέρα_Τρίτη_Τετάρτη_� έμπτη_� αρασκευή_Σάββατο'.split('_'),
            weekdaysShort: 'Κυρ_Δευ_Τρι_Τετ_� εμ_� αρ_Σαβ'.split('_'),
            weekdaysMin: 'Κυ_Δε_Τρ_Τε_� ε_� α_Σα'.split('_'),
            meridiem: function (hours, minutes, isLower) {
                if (hours > 11) {
                    return isLower ? 'μμ' : 'ΜΜ';
                } else {
                    return isLower ? 'πμ' : '� Μ';
                }
            },
            isPM: function (input) {
                return ((input + '').toLowerCase()[0] === 'μ');
            },
            meridiemParse: /[� Μ]\.?Μ?\.?/i,
            longDateFormat: {
                LT: 'h:mm A',
                LTS: 'h:mm:ss A',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendarEl: {
                sameDay: '[Σήμερα {}] LT',
                nextDay: '[Αύριο {}] LT',
                nextWeek: 'dddd [{}] LT',
                lastDay: '[Χθες {}] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 6:
                            return '[το προηγούμενο] dddd [{}] LT';
                        default:
                            return '[την προηγούμενη] dddd [{}] LT';
                    }
                },
                sameElse: 'L'
            },
            calendar: function (key, mom) {
                var output = this._calendarEl[key],
                    hours = mom && mom.hours();

                if (typeof output === 'function') {
                    output = output.apply(mom);
                }

                return output.replace('{}', (hours % 12 === 1 ? 'στη' : 'στις'));
            },
            relativeTime: {
                future: 'σε %s',
                past: '%s πριν',
                s: 'λίγα δευτερόλεπτα',
                m: 'ένα λεπτό',
                mm: '%d λεπτά',
                h: 'μία ώρα',
                hh: '%d ώρες',
                d: 'μία μέρα',
                dd: '%d μέρες',
                M: 'ένας μήνας',
                MM: '%d μήνες',
                y: 'ένας χρόνος',
                yy: '%d χρόνια'
            },
            ordinalParse: /\d{1,2}η/,
            ordinal: '%dη',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : australian english (en-au)

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('en-au', {
            months: 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
            monthsShort: 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
            weekdays: 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
            weekdaysShort: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
            weekdaysMin: 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'h:mm A',
                LTS: 'h:mm:ss A',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Today at] LT',
                nextDay: '[Tomorrow at] LT',
                nextWeek: 'dddd [at] LT',
                lastDay: '[Yesterday at] LT',
                lastWeek: '[Last] dddd [at] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'in %s',
                past: '%s ago',
                s: 'a few seconds',
                m: 'a minute',
                mm: '%d minutes',
                h: 'an hour',
                hh: '%d hours',
                d: 'a day',
                dd: '%d days',
                M: 'a month',
                MM: '%d months',
                y: 'a year',
                yy: '%d years'
            },
            ordinalParse: /\d{1,2}(st|nd|rd|th)/,
            ordinal: function (number) {
                var b = number % 10,
                    output = (~~(number % 100 / 10) === 1) ? 'th' :
                    (b === 1) ? 'st' :
                    (b === 2) ? 'nd' :
                    (b === 3) ? 'rd' : 'th';
                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : canadian english (en-ca)
    // author : Jonathan Abourbih : https://github.com/jonbca

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('en-ca', {
            months: 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
            monthsShort: 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
            weekdays: 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
            weekdaysShort: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
            weekdaysMin: 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'h:mm A',
                LTS: 'h:mm:ss A',
                L: 'YYYY-MM-DD',
                LL: 'D MMMM, YYYY',
                LLL: 'D MMMM, YYYY LT',
                LLLL: 'dddd, D MMMM, YYYY LT'
            },
            calendar: {
                sameDay: '[Today at] LT',
                nextDay: '[Tomorrow at] LT',
                nextWeek: 'dddd [at] LT',
                lastDay: '[Yesterday at] LT',
                lastWeek: '[Last] dddd [at] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'in %s',
                past: '%s ago',
                s: 'a few seconds',
                m: 'a minute',
                mm: '%d minutes',
                h: 'an hour',
                hh: '%d hours',
                d: 'a day',
                dd: '%d days',
                M: 'a month',
                MM: '%d months',
                y: 'a year',
                yy: '%d years'
            },
            ordinalParse: /\d{1,2}(st|nd|rd|th)/,
            ordinal: function (number) {
                var b = number % 10,
                    output = (~~(number % 100 / 10) === 1) ? 'th' :
                    (b === 1) ? 'st' :
                    (b === 2) ? 'nd' :
                    (b === 3) ? 'rd' : 'th';
                return number + output;
            }
        });
    }));
    // moment.js locale configuration
    // locale : great britain english (en-gb)
    // author : Chris Gedrim : https://github.com/chrisgedrim

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('en-gb', {
            months: 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
            monthsShort: 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
            weekdays: 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
            weekdaysShort: 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
            weekdaysMin: 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Today at] LT',
                nextDay: '[Tomorrow at] LT',
                nextWeek: 'dddd [at] LT',
                lastDay: '[Yesterday at] LT',
                lastWeek: '[Last] dddd [at] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'in %s',
                past: '%s ago',
                s: 'a few seconds',
                m: 'a minute',
                mm: '%d minutes',
                h: 'an hour',
                hh: '%d hours',
                d: 'a day',
                dd: '%d days',
                M: 'a month',
                MM: '%d months',
                y: 'a year',
                yy: '%d years'
            },
            ordinalParse: /\d{1,2}(st|nd|rd|th)/,
            ordinal: function (number) {
                var b = number % 10,
                    output = (~~(number % 100 / 10) === 1) ? 'th' :
                    (b === 1) ? 'st' :
                    (b === 2) ? 'nd' :
                    (b === 3) ? 'rd' : 'th';
                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : esperanto (eo)
    // author : Colin Dean : https://github.com/colindean
    // komento: Mi estas malcerta se mi korekte traktis akuzativojn en tiu traduko.
    //          Se ne, bonvolu korekti kaj avizi min por ke mi povas lerni!

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('eo', {
            months: 'januaro_februaro_marto_aprilo_majo_junio_julio_aŭgusto_septembro_oktobro_novembro_decembro'.split('_'),
            monthsShort: 'jan_feb_mar_apr_maj_jun_jul_aŭg_sep_okt_nov_dec'.split('_'),
            weekdays: 'Dimanĉo_Lundo_Mardo_Merkredo_Ĵaŭdo_Vendredo_Sabato'.split('_'),
            weekdaysShort: 'Dim_Lun_Mard_Merk_Ĵaŭ_Ven_Sab'.split('_'),
            weekdaysMin: 'Di_Lu_Ma_Me_Ĵa_Ve_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'YYYY-MM-DD',
                LL: 'D[-an de] MMMM, YYYY',
                LLL: 'D[-an de] MMMM, YYYY LT',
                LLLL: 'dddd, [la] D[-an de] MMMM, YYYY LT'
            },
            meridiemParse: /[ap]\.t\.m/i,
            isPM: function (input) {
                return input.charAt(0).toLowerCase() === 'p';
            },
            meridiem: function (hours, minutes, isLower) {
                if (hours > 11) {
                    return isLower ? 'p.t.m.' : 'P.T.M.';
                } else {
                    return isLower ? 'a.t.m.' : 'A.T.M.';
                }
            },
            calendar: {
                sameDay: '[Hodiaŭ je] LT',
                nextDay: '[Morgaŭ je] LT',
                nextWeek: 'dddd [je] LT',
                lastDay: '[Hieraŭ je] LT',
                lastWeek: '[pasinta] dddd [je] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'je %s',
                past: 'antaŭ %s',
                s: 'sekundoj',
                m: 'minuto',
                mm: '%d minutoj',
                h: 'horo',
                hh: '%d horoj',
                d: 'tago',//ne 'diurno', ĉar estas uzita por proksimumo
                dd: '%d tagoj',
                M: 'monato',
                MM: '%d monatoj',
                y: 'jaro',
                yy: '%d jaroj'
            },
            ordinalParse: /\d{1,2}a/,
            ordinal: '%da',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : spanish (es)
    // author : Julio Napurí : https://github.com/julionc

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var monthsShortDot = 'ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.'.split('_'),
            monthsShort = 'ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic'.split('_');

        return moment.defineLocale('es', {
            months: 'enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre'.split('_'),
            monthsShort: function (m, format) {
                if (/-MMM-/.test(format)) {
                    return monthsShort[m.month()];
                } else {
                    return monthsShortDot[m.month()];
                }
            },
            weekdays: 'domingo_lunes_martes_miércoles_jueves_viernes_sábado'.split('_'),
            weekdaysShort: 'dom._lun._mar._mié._jue._vie._sáb.'.split('_'),
            weekdaysMin: 'Do_Lu_Ma_Mi_Ju_Vi_Sá'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D [de] MMMM [de] YYYY',
                LLL: 'D [de] MMMM [de] YYYY LT',
                LLLL: 'dddd, D [de] MMMM [de] YYYY LT'
            },
            calendar: {
                sameDay: function () {
                    return '[hoy a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
                },
                nextDay: function () {
                    return '[mañana a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
                },
                nextWeek: function () {
                    return 'dddd [a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
                },
                lastDay: function () {
                    return '[ayer a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
                },
                lastWeek: function () {
                    return '[el] dddd [pasado a la' + ((this.hours() !== 1) ? 's' : '') + '] LT';
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'en %s',
                past: 'hace %s',
                s: 'unos segundos',
                m: 'un minuto',
                mm: '%d minutos',
                h: 'una hora',
                hh: '%d horas',
                d: 'un día',
                dd: '%d días',
                M: 'un mes',
                MM: '%d meses',
                y: 'un año',
                yy: '%d años'
            },
            ordinalParse: /\d{1,2}º/,
            ordinal: '%dº',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : estonian (et)
    // author : Henry Kehlmann : https://github.com/madhenry
    // improvements : Illimar Tambek : https://github.com/ragulka

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function processRelativeTime(number, withoutSuffix, key, isFuture) {
            var format = {
                's': ['mõne sekundi', 'mõni sekund', 'paar sekundit'],
                'm': ['ühe minuti', 'üks minut'],
                'mm': [number + ' minuti', number + ' minutit'],
                'h': ['ühe tunni', 'tund aega', 'üks tund'],
                'hh': [number + ' tunni', number + ' tundi'],
                'd': ['ühe päeva', 'üks päev'],
                'M': ['kuu aja', 'kuu aega', 'üks kuu'],
                'MM': [number + ' kuu', number + ' kuud'],
                'y': ['ühe aasta', 'aasta', 'üks aasta'],
                'yy': [number + ' aasta', number + ' aastat']
            };
            if (withoutSuffix) {
                return format[key][2] ? format[key][2] : format[key][1];
            }
            return isFuture ? format[key][0] : format[key][1];
        }

        return moment.defineLocale('et', {
            months: 'jaanuar_veebruar_märts_aprill_mai_juuni_juuli_august_september_oktoober_november_detsember'.split('_'),
            monthsShort: 'jaan_veebr_märts_apr_mai_juuni_juuli_aug_sept_okt_nov_dets'.split('_'),
            weekdays: 'pühapäev_esmaspäev_teisipäev_kolmapäev_neljapäev_reede_laupäev'.split('_'),
            weekdaysShort: 'P_E_T_K_N_R_L'.split('_'),
            weekdaysMin: 'P_E_T_K_N_R_L'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Täna,] LT',
                nextDay: '[Homme,] LT',
                nextWeek: '[Järgmine] dddd LT',
                lastDay: '[Eile,] LT',
                lastWeek: '[Eelmine] dddd LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s pärast',
                past: '%s tagasi',
                s: processRelativeTime,
                m: processRelativeTime,
                mm: processRelativeTime,
                h: processRelativeTime,
                hh: processRelativeTime,
                d: processRelativeTime,
                dd: '%d päeva',
                M: processRelativeTime,
                MM: processRelativeTime,
                y: processRelativeTime,
                yy: processRelativeTime
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : euskara (eu)
    // author : Eneko Illarramendi : https://github.com/eillarra

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('eu', {
            months: 'urtarrila_otsaila_martxoa_apirila_maiatza_ekaina_uztaila_abuztua_iraila_urria_azaroa_abendua'.split('_'),
            monthsShort: 'urt._ots._mar._api._mai._eka._uzt._abu._ira._urr._aza._abe.'.split('_'),
            weekdays: 'igandea_astelehena_asteartea_asteazkena_osteguna_ostirala_larunbata'.split('_'),
            weekdaysShort: 'ig._al._ar._az._og._ol._lr.'.split('_'),
            weekdaysMin: 'ig_al_ar_az_og_ol_lr'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'YYYY-MM-DD',
                LL: 'YYYY[ko] MMMM[ren] D[a]',
                LLL: 'YYYY[ko] MMMM[ren] D[a] LT',
                LLLL: 'dddd, YYYY[ko] MMMM[ren] D[a] LT',
                l: 'YYYY-M-D',
                ll: 'YYYY[ko] MMM D[a]',
                lll: 'YYYY[ko] MMM D[a] LT',
                llll: 'ddd, YYYY[ko] MMM D[a] LT'
            },
            calendar: {
                sameDay: '[gaur] LT[etan]',
                nextDay: '[bihar] LT[etan]',
                nextWeek: 'dddd LT[etan]',
                lastDay: '[atzo] LT[etan]',
                lastWeek: '[aurreko] dddd LT[etan]',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s barru',
                past: 'duela %s',
                s: 'segundo batzuk',
                m: 'minutu bat',
                mm: '%d minutu',
                h: 'ordu bat',
                hh: '%d ordu',
                d: 'egun bat',
                dd: '%d egun',
                M: 'hilabete bat',
                MM: '%d hilabete',
                y: 'urte bat',
                yy: '%d urte'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Persian (fa)
    // author : Ebrahim Byagowi : https://github.com/ebraminio

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '۱',
            '2': '۲',
            '3': '۳',
            '4': '۴',
            '5': '۵',
            '6': '۶',
            '7': '۷',
            '8': '۸',
            '9': '۹',
            '0': '۰'
        }, numberMap = {
            '۱': '1',
            '۲': '2',
            '۳': '3',
            '۴': '4',
            '۵': '5',
            '۶': '6',
            '۷': '7',
            '۸': '8',
            '۹': '9',
            '۰': '0'
        };

        return moment.defineLocale('fa', {
            months: 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
            monthsShort: 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
            weekdays: 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
            weekdaysShort: 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
            weekdaysMin: 'ی_د_س_چ_پ_ج_ش'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            meridiemParse: /قبل از ظهر|بعد از ظهر/,
            isPM: function (input) {
                return /بعد از ظهر/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 12) {
                    return 'قبل از ظهر';
                } else {
                    return 'بعد از ظهر';
                }
            },
            calendar: {
                sameDay: '[امروز ساعت] LT',
                nextDay: '[فردا ساعت] LT',
                nextWeek: 'dddd [ساعت] LT',
                lastDay: '[دیروز ساعت] LT',
                lastWeek: 'dddd [پیش] [ساعت] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'در %s',
                past: '%s پیش',
                s: 'چندین ثانیه',
                m: 'یک دقیقه',
                mm: '%d دقیقه',
                h: 'یک ساعت',
                hh: '%d ساعت',
                d: 'یک روز',
                dd: '%d روز',
                M: 'یک ماه',
                MM: '%d ماه',
                y: 'یک سال',
                yy: '%d سال'
            },
            preparse: function (string) {
                return string.replace(/[۰-۹]/g, function (match) {
                    return numberMap[match];
                }).replace(/،/g, ',');
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                }).replace(/,/g, '،');
            },
            ordinalParse: /\d{1,2}م/,
            ordinal: '%dم',
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12 // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : finnish (fi)
    // author : Tarmo Aidantausta : https://github.com/bleadof

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var numbersPast = 'nolla yksi kaksi kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän'.split(' '),
            numbersFuture = [
                'nolla', 'yhden', 'kahden', 'kolmen', 'neljän', 'viiden', 'kuuden',
                numbersPast[7], numbersPast[8], numbersPast[9]
            ];

        function translate(number, withoutSuffix, key, isFuture) {
            var result = '';
            switch (key) {
                case 's':
                    return isFuture ? 'muutaman sekunnin' : 'muutama sekunti';
                case 'm':
                    return isFuture ? 'minuutin' : 'minuutti';
                case 'mm':
                    result = isFuture ? 'minuutin' : 'minuuttia';
                    break;
                case 'h':
                    return isFuture ? 'tunnin' : 'tunti';
                case 'hh':
                    result = isFuture ? 'tunnin' : 'tuntia';
                    break;
                case 'd':
                    return isFuture ? 'päivän' : 'päivä';
                case 'dd':
                    result = isFuture ? 'päivän' : 'päivää';
                    break;
                case 'M':
                    return isFuture ? 'kuukauden' : 'kuukausi';
                case 'MM':
                    result = isFuture ? 'kuukauden' : 'kuukautta';
                    break;
                case 'y':
                    return isFuture ? 'vuoden' : 'vuosi';
                case 'yy':
                    result = isFuture ? 'vuoden' : 'vuotta';
                    break;
            }
            result = verbalNumber(number, isFuture) + ' ' + result;
            return result;
        }

        function verbalNumber(number, isFuture) {
            return number < 10 ? (isFuture ? numbersFuture[number] : numbersPast[number]) : number;
        }

        return moment.defineLocale('fi', {
            months: 'tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesäkuu_heinäkuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu'.split('_'),
            monthsShort: 'tammi_helmi_maalis_huhti_touko_kesä_heinä_elo_syys_loka_marras_joulu'.split('_'),
            weekdays: 'sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai'.split('_'),
            weekdaysShort: 'su_ma_ti_ke_to_pe_la'.split('_'),
            weekdaysMin: 'su_ma_ti_ke_to_pe_la'.split('_'),
            longDateFormat: {
                LT: 'HH.mm',
                LTS: 'HH.mm.ss',
                L: 'DD.MM.YYYY',
                LL: 'Do MMMM[ta] YYYY',
                LLL: 'Do MMMM[ta] YYYY, [klo] LT',
                LLLL: 'dddd, Do MMMM[ta] YYYY, [klo] LT',
                l: 'D.M.YYYY',
                ll: 'Do MMM YYYY',
                lll: 'Do MMM YYYY, [klo] LT',
                llll: 'ddd, Do MMM YYYY, [klo] LT'
            },
            calendar: {
                sameDay: '[tänään] [klo] LT',
                nextDay: '[huomenna] [klo] LT',
                nextWeek: 'dddd [klo] LT',
                lastDay: '[eilen] [klo] LT',
                lastWeek: '[viime] dddd[na] [klo] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s päästä',
                past: '%s sitten',
                s: translate,
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: translate,
                dd: translate,
                M: translate,
                MM: translate,
                y: translate,
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : faroese (fo)
    // author : Ragnar Johannesen : https://github.com/ragnar123

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('fo', {
            months: 'januar_februar_mars_apríl_mai_juni_juli_august_september_oktober_november_desember'.split('_'),
            monthsShort: 'jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des'.split('_'),
            weekdays: 'sunnudagur_mánadagur_týsdagur_mikudagur_hósdagur_fríggjadagur_leygardagur'.split('_'),
            weekdaysShort: 'sun_mán_týs_mik_hós_frí_ley'.split('_'),
            weekdaysMin: 'su_má_tý_mi_hó_fr_le'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D. MMMM, YYYY LT'
            },
            calendar: {
                sameDay: '[Í dag kl.] LT',
                nextDay: '[Í morgin kl.] LT',
                nextWeek: 'dddd [kl.] LT',
                lastDay: '[Í gjár kl.] LT',
                lastWeek: '[síðstu] dddd [kl] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'um %s',
                past: '%s síðani',
                s: 'fá sekund',
                m: 'ein minutt',
                mm: '%d minuttir',
                h: 'ein tími',
                hh: '%d tímar',
                d: 'ein dagur',
                dd: '%d dagar',
                M: 'ein mánaði',
                MM: '%d mánaðir',
                y: 'eitt ár',
                yy: '%d ár'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : canadian french (fr-ca)
    // author : Jonathan Abourbih : https://github.com/jonbca

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('fr-ca', {
            months: 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
            monthsShort: 'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'.split('_'),
            weekdays: 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_'),
            weekdaysShort: 'dim._lun._mar._mer._jeu._ven._sam.'.split('_'),
            weekdaysMin: 'Di_Lu_Ma_Me_Je_Ve_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'YYYY-MM-DD',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Aujourd\'hui � ] LT',
                nextDay: '[Demain � ] LT',
                nextWeek: 'dddd [� ] LT',
                lastDay: '[Hier � ] LT',
                lastWeek: 'dddd [dernier � ] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'dans %s',
                past: 'il y a %s',
                s: 'quelques secondes',
                m: 'une minute',
                mm: '%d minutes',
                h: 'une heure',
                hh: '%d heures',
                d: 'un jour',
                dd: '%d jours',
                M: 'un mois',
                MM: '%d mois',
                y: 'un an',
                yy: '%d ans'
            },
            ordinalParse: /\d{1,2}(er|)/,
            ordinal: function (number) {
                return number + (number === 1 ? 'er' : '');
            }
        });
    }));
    // moment.js locale configuration
    // locale : french (fr)
    // author : John Fischer : https://github.com/jfroffice

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('fr', {
            months: 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
            monthsShort: 'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'.split('_'),
            weekdays: 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_'),
            weekdaysShort: 'dim._lun._mar._mer._jeu._ven._sam.'.split('_'),
            weekdaysMin: 'Di_Lu_Ma_Me_Je_Ve_Sa'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Aujourd\'hui � ] LT',
                nextDay: '[Demain � ] LT',
                nextWeek: 'dddd [� ] LT',
                lastDay: '[Hier � ] LT',
                lastWeek: 'dddd [dernier � ] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'dans %s',
                past: 'il y a %s',
                s: 'quelques secondes',
                m: 'une minute',
                mm: '%d minutes',
                h: 'une heure',
                hh: '%d heures',
                d: 'un jour',
                dd: '%d jours',
                M: 'un mois',
                MM: '%d mois',
                y: 'un an',
                yy: '%d ans'
            },
            ordinalParse: /\d{1,2}(er|)/,
            ordinal: function (number) {
                return number + (number === 1 ? 'er' : '');
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : frisian (fy)
    // author : Robin van der Vliet : https://github.com/robin0van0der0v

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var monthsShortWithDots = 'jan._feb._mrt._apr._mai_jun._jul._aug._sep._okt._nov._des.'.split('_'),
            monthsShortWithoutDots = 'jan_feb_mrt_apr_mai_jun_jul_aug_sep_okt_nov_des'.split('_');

        return moment.defineLocale('fy', {
            months: 'jannewaris_febrewaris_maart_april_maaie_juny_july_augustus_septimber_oktober_novimber_desimber'.split('_'),
            monthsShort: function (m, format) {
                if (/-MMM-/.test(format)) {
                    return monthsShortWithoutDots[m.month()];
                } else {
                    return monthsShortWithDots[m.month()];
                }
            },
            weekdays: 'snein_moandei_tiisdei_woansdei_tongersdei_freed_sneon'.split('_'),
            weekdaysShort: 'si._mo._ti._wo._to._fr._so.'.split('_'),
            weekdaysMin: 'Si_Mo_Ti_Wo_To_Fr_So'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD-MM-YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[hjoed om] LT',
                nextDay: '[moarn om] LT',
                nextWeek: 'dddd [om] LT',
                lastDay: '[juster om] LT',
                lastWeek: '[ôfrûne] dddd [om] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'oer %s',
                past: '%s lyn',
                s: 'in pear sekonden',
                m: 'ien minút',
                mm: '%d minuten',
                h: 'ien oere',
                hh: '%d oeren',
                d: 'ien dei',
                dd: '%d dagen',
                M: 'ien moanne',
                MM: '%d moannen',
                y: 'ien jier',
                yy: '%d jierren'
            },
            ordinalParse: /\d{1,2}(ste|de)/,
            ordinal: function (number) {
                return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : galician (gl)
    // author : Juan G. Hurtado : https://github.com/juanghurtado

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('gl', {
            months: 'Xaneiro_Febreiro_Marzo_Abril_Maio_Xuño_Xullo_Agosto_Setembro_Outubro_Novembro_Decembro'.split('_'),
            monthsShort: 'Xan._Feb._Mar._Abr._Mai._Xuñ._Xul._Ago._Set._Out._Nov._Dec.'.split('_'),
            weekdays: 'Domingo_Luns_Martes_Mércores_Xoves_Venres_Sábado'.split('_'),
            weekdaysShort: 'Dom._Lun._Mar._Mér._Xov._Ven._Sáb.'.split('_'),
            weekdaysMin: 'Do_Lu_Ma_Mé_Xo_Ve_Sá'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: function () {
                    return '[hoxe ' + ((this.hours() !== 1) ? 'ás' : 'á') + '] LT';
                },
                nextDay: function () {
                    return '[mañá ' + ((this.hours() !== 1) ? 'ás' : 'á') + '] LT';
                },
                nextWeek: function () {
                    return 'dddd [' + ((this.hours() !== 1) ? 'ás' : 'a') + '] LT';
                },
                lastDay: function () {
                    return '[onte ' + ((this.hours() !== 1) ? 'á' : 'a') + '] LT';
                },
                lastWeek: function () {
                    return '[o] dddd [pasado ' + ((this.hours() !== 1) ? 'ás' : 'a') + '] LT';
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: function (str) {
                    if (str === 'uns segundos') {
                        return 'nuns segundos';
                    }
                    return 'en ' + str;
                },
                past: 'hai %s',
                s: 'uns segundos',
                m: 'un minuto',
                mm: '%d minutos',
                h: 'unha hora',
                hh: '%d horas',
                d: 'un día',
                dd: '%d días',
                M: 'un mes',
                MM: '%d meses',
                y: 'un ano',
                yy: '%d anos'
            },
            ordinalParse: /\d{1,2}º/,
            ordinal: '%dº',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Hebrew (he)
    // author : Tomer Cohen : https://github.com/tomer
    // author : Moshe Simantov : https://github.com/DevelopmentIL
    // author : Tal Ater : https://github.com/TalAter

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('he', {
            months: 'י� ואר_פברואר_מרץ_אפריל_מאי_יו� י_יולי_אוגוסט_ספטמבר_אוקטובר_� ובמבר_דצמבר'.split('_'),
            monthsShort: 'י� ו׳_פבר׳_מרץ_אפר׳_מאי_יו� י_יולי_אוג׳_ספט׳_אוק׳_� וב׳_דצמ׳'.split('_'),
            weekdays: 'ראשון_ש� י_שלישי_רביעי_חמישי_שישי_שבת'.split('_'),
            weekdaysShort: 'א׳_ב׳_ג׳_ד׳_ה׳_ו׳_ש׳'.split('_'),
            weekdaysMin: 'א_ב_ג_ד_ה_ו_ש'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D [ב]MMMM YYYY',
                LLL: 'D [ב]MMMM YYYY LT',
                LLLL: 'dddd, D [ב]MMMM YYYY LT',
                l: 'D/M/YYYY',
                ll: 'D MMM YYYY',
                lll: 'D MMM YYYY LT',
                llll: 'ddd, D MMM YYYY LT'
            },
            calendar: {
                sameDay: '[היום ב־]LT',
                nextDay: '[מחר ב־]LT',
                nextWeek: 'dddd [בשעה] LT',
                lastDay: '[אתמול ב־]LT',
                lastWeek: '[ביום] dddd [האחרון בשעה] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'בעוד %s',
                past: 'לפ� י %s',
                s: 'מספר ש� יות',
                m: 'דקה',
                mm: '%d דקות',
                h: 'שעה',
                hh: function (number) {
                    if (number === 2) {
                        return 'שעתיים';
                    }
                    return number + ' שעות';
                },
                d: 'יום',
                dd: function (number) {
                    if (number === 2) {
                        return 'יומיים';
                    }
                    return number + ' ימים';
                },
                M: 'חודש',
                MM: function (number) {
                    if (number === 2) {
                        return 'חודשיים';
                    }
                    return number + ' חודשים';
                },
                y: 'ש� ה',
                yy: function (number) {
                    if (number === 2) {
                        return 'ש� תיים';
                    } else if (number % 10 === 0 && number !== 10) {
                        return number + ' ש� ה';
                    }
                    return number + ' ש� ים';
                }
            }
        });
    }));
    // moment.js locale configuration
    // locale : hindi (hi)
    // author : Mayank Singhal : https://github.com/mayanksinghal

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '१',
            '2': '२',
            '3': '३',
            '4': '४',
            '5': '५',
            '6': '६',
            '7': '७',
            '8': '८',
            '9': '९',
            '0': '०'
        },
        numberMap = {
            '१': '1',
            '२': '2',
            '३': '3',
            '४': '4',
            '५': '5',
            '६': '6',
            '७': '7',
            '८': '8',
            '९': '9',
            '०': '0'
        };

        return moment.defineLocale('hi', {
            months: 'जनवरी_फ़रवरी_मार्च_अप्रैल_मई_जून_जुलाई_अगस्त_सितम्बर_अक्टूबर_नवम्बर_दिसम्बर'.split('_'),
            monthsShort: 'जन._फ़र._मार्च_अप्रै._मई_जून_जुल._अग._सित._अक्टू._नव._दिस.'.split('_'),
            weekdays: 'रविवार_सोमवार_मंगलवार_बुधवार_गुरूवार_शुक्रवार_शनिवार'.split('_'),
            weekdaysShort: 'रवि_सोम_मंगल_बुध_गुरू_शुक्र_शनि'.split('_'),
            weekdaysMin: 'र_सो_मं_बु_गु_शु_श'.split('_'),
            longDateFormat: {
                LT: 'A h:mm बजे',
                LTS: 'A h:mm:ss बजे',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[आज] LT',
                nextDay: '[कल] LT',
                nextWeek: 'dddd, LT',
                lastDay: '[कल] LT',
                lastWeek: '[पिछले] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s में',
                past: '%s पहले',
                s: 'कुछ ही क्षण',
                m: 'एक मिनट',
                mm: '%d मिनट',
                h: 'एक घंटा',
                hh: '%d घंटे',
                d: 'एक दिन',
                dd: '%d दिन',
                M: 'एक महीने',
                MM: '%d महीने',
                y: 'एक वर्ष',
                yy: '%d वर्ष'
            },
            preparse: function (string) {
                return string.replace(/[१२३४५६७८९०]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            // Hindi notation for meridiems are quite fuzzy in practice. While there exists
            // a rigid notion of a 'Pahar' it is not used as rigidly in modern Hindi.
            meridiemParse: /रात|सुबह|दोपहर|शाम/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'रात') {
                    return hour < 4 ? hour : hour + 12;
                } else if (meridiem === 'सुबह') {
                    return hour;
                } else if (meridiem === 'दोपहर') {
                    return hour >= 10 ? hour : hour + 12;
                } else if (meridiem === 'शाम') {
                    return hour + 12;
                }
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'रात';
                } else if (hour < 10) {
                    return 'सुबह';
                } else if (hour < 17) {
                    return 'दोपहर';
                } else if (hour < 20) {
                    return 'शाम';
                } else {
                    return 'रात';
                }
            },
            week: {
                dow: 0, // Sunday is the first day of the week.
                doy: 6  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : hrvatski (hr)
    // author : Bojan Marković : https://github.com/bmarkovic

    // based on (sl) translation by Robert Sedovšek

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function translate(number, withoutSuffix, key) {
            var result = number + ' ';
            switch (key) {
                case 'm':
                    return withoutSuffix ? 'jedna minuta' : 'jedne minute';
                case 'mm':
                    if (number === 1) {
                        result += 'minuta';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'minute';
                    } else {
                        result += 'minuta';
                    }
                    return result;
                case 'h':
                    return withoutSuffix ? 'jedan sat' : 'jednog sata';
                case 'hh':
                    if (number === 1) {
                        result += 'sat';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'sata';
                    } else {
                        result += 'sati';
                    }
                    return result;
                case 'dd':
                    if (number === 1) {
                        result += 'dan';
                    } else {
                        result += 'dana';
                    }
                    return result;
                case 'MM':
                    if (number === 1) {
                        result += 'mjesec';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'mjeseca';
                    } else {
                        result += 'mjeseci';
                    }
                    return result;
                case 'yy':
                    if (number === 1) {
                        result += 'godina';
                    } else if (number === 2 || number === 3 || number === 4) {
                        result += 'godine';
                    } else {
                        result += 'godina';
                    }
                    return result;
            }
        }

        return moment.defineLocale('hr', {
            months: 'sječanj_veljača_ožujak_travanj_svibanj_lipanj_srpanj_kolovoz_rujan_listopad_studeni_prosinac'.split('_'),
            monthsShort: 'sje._vel._ožu._tra._svi._lip._srp._kol._ruj._lis._stu._pro.'.split('_'),
            weekdays: 'nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota'.split('_'),
            weekdaysShort: 'ned._pon._uto._sri._čet._pet._sub.'.split('_'),
            weekdaysMin: 'ne_po_ut_sr_če_pe_su'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD. MM. YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[danas u] LT',
                nextDay: '[sutra u] LT',

                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[u] [nedjelju] [u] LT';
                        case 3:
                            return '[u] [srijedu] [u] LT';
                        case 6:
                            return '[u] [subotu] [u] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[u] dddd [u] LT';
                    }
                },
                lastDay: '[jučer u] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                            return '[prošlu] dddd [u] LT';
                        case 6:
                            return '[prošle] [subote] [u] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[prošli] dddd [u] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: 'prije %s',
                s: 'par sekundi',
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: 'dan',
                dd: translate,
                M: 'mjesec',
                MM: translate,
                y: 'godinu',
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : hungarian (hu)
    // author : Adam Brunner : https://github.com/adambrunner

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var weekEndings = 'vasárnap hétfőn kedden szerdán csütörtökön pénteken szombaton'.split(' ');

        function translate(number, withoutSuffix, key, isFuture) {
            var num = number,
                suffix;

            switch (key) {
                case 's':
                    return (isFuture || withoutSuffix) ? 'néhány másodperc' : 'néhány másodperce';
                case 'm':
                    return 'egy' + (isFuture || withoutSuffix ? ' perc' : ' perce');
                case 'mm':
                    return num + (isFuture || withoutSuffix ? ' perc' : ' perce');
                case 'h':
                    return 'egy' + (isFuture || withoutSuffix ? ' óra' : ' órája');
                case 'hh':
                    return num + (isFuture || withoutSuffix ? ' óra' : ' órája');
                case 'd':
                    return 'egy' + (isFuture || withoutSuffix ? ' nap' : ' napja');
                case 'dd':
                    return num + (isFuture || withoutSuffix ? ' nap' : ' napja');
                case 'M':
                    return 'egy' + (isFuture || withoutSuffix ? ' hónap' : ' hónapja');
                case 'MM':
                    return num + (isFuture || withoutSuffix ? ' hónap' : ' hónapja');
                case 'y':
                    return 'egy' + (isFuture || withoutSuffix ? ' év' : ' éve');
                case 'yy':
                    return num + (isFuture || withoutSuffix ? ' év' : ' éve');
            }

            return '';
        }

        function week(isFuture) {
            return (isFuture ? '' : '[múlt] ') + '[' + weekEndings[this.day()] + '] LT[-kor]';
        }

        return moment.defineLocale('hu', {
            months: 'január_február_március_április_május_június_július_augusztus_szeptember_október_november_december'.split('_'),
            monthsShort: 'jan_feb_márc_ápr_máj_jún_júl_aug_szept_okt_nov_dec'.split('_'),
            weekdays: 'vasárnap_hétfő_kedd_szerda_csütörtök_péntek_szombat'.split('_'),
            weekdaysShort: 'vas_hét_kedd_sze_csüt_pén_szo'.split('_'),
            weekdaysMin: 'v_h_k_sze_cs_p_szo'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'YYYY.MM.DD.',
                LL: 'YYYY. MMMM D.',
                LLL: 'YYYY. MMMM D., LT',
                LLLL: 'YYYY. MMMM D., dddd LT'
            },
            meridiemParse: /de|du/i,
            isPM: function (input) {
                return input.charAt(1).toLowerCase() === 'u';
            },
            meridiem: function (hours, minutes, isLower) {
                if (hours < 12) {
                    return isLower === true ? 'de' : 'DE';
                } else {
                    return isLower === true ? 'du' : 'DU';
                }
            },
            calendar: {
                sameDay: '[ma] LT[-kor]',
                nextDay: '[holnap] LT[-kor]',
                nextWeek: function () {
                    return week.call(this, true);
                },
                lastDay: '[tegnap] LT[-kor]',
                lastWeek: function () {
                    return week.call(this, false);
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s múlva',
                past: '%s',
                s: translate,
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: translate,
                dd: translate,
                M: translate,
                MM: translate,
                y: translate,
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Armenian (hy-am)
    // author : Armendarabyan : https://github.com/armendarabyan

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function monthsCaseReplace(m, format) {
            var months = {
                'nominative': 'հունվար_փետրվար_մարտ_ապրիլ_մայիս_հունիս_հուլիս_օգոստոս_սեպտեմբեր_հոկտեմբեր_նոյեմբեր_դեկտեմբեր'.split('_'),
                'accusative': 'հունվարի_փետրվարի_մարտի_ապրիլի_մայիսի_հունիսի_հուլիսի_օգոստոսի_սեպտեմբերի_հոկտեմբերի_նոյեմբերի_դեկտեմբերի'.split('_')
            },

            nounCase = (/D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return months[nounCase][m.month()];
        }

        function monthsShortCaseReplace(m, format) {
            var monthsShort = 'հնվ_փտր_մրտ_ապր_մյս_հնս_հլս_օգս_սպտ_հկտ_նմբ_դկտ'.split('_');

            return monthsShort[m.month()];
        }

        function weekdaysCaseReplace(m, format) {
            var weekdays = 'կիրակի_երկուշաբթի_երեքշաբթի_չորեքշաբթի_հինգշաբթի_ուրբաթ_շաբաթ'.split('_');

            return weekdays[m.day()];
        }

        return moment.defineLocale('hy-am', {
            months: monthsCaseReplace,
            monthsShort: monthsShortCaseReplace,
            weekdays: weekdaysCaseReplace,
            weekdaysShort: 'կրկ_երկ_երք_չրք_հնգ_ուրբ_շբթ'.split('_'),
            weekdaysMin: 'կրկ_երկ_երք_չրք_հնգ_ուրբ_շբթ'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY թ.',
                LLL: 'D MMMM YYYY թ., LT',
                LLLL: 'dddd, D MMMM YYYY թ., LT'
            },
            calendar: {
                sameDay: '[այսօր] LT',
                nextDay: '[վաղը] LT',
                lastDay: '[երեկ] LT',
                nextWeek: function () {
                    return 'dddd [օրը ժամը] LT';
                },
                lastWeek: function () {
                    return '[անցած] dddd [օրը ժամը] LT';
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s հետո',
                past: '%s առաջ',
                s: 'մի քանի վայրկյան',
                m: 'րոպե',
                mm: '%d րոպե',
                h: 'ժամ',
                hh: '%d ժամ',
                d: 'օր',
                dd: '%d օր',
                M: 'ամիս',
                MM: '%d ամիս',
                y: 'տարի',
                yy: '%d տարի'
            },

            meridiemParse: /գիշերվա|առավոտվա|ցերեկվա|երեկոյան/,
            isPM: function (input) {
                return /^(ցերեկվա|երեկոյան)$/.test(input);
            },
            meridiem: function (hour) {
                if (hour < 4) {
                    return 'գիշերվա';
                } else if (hour < 12) {
                    return 'առավոտվա';
                } else if (hour < 17) {
                    return 'ցերեկվա';
                } else {
                    return 'երեկոյան';
                }
            },

            ordinalParse: /\d{1,2}|\d{1,2}-(ին|րդ)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'DDD':
                    case 'w':
                    case 'W':
                    case 'DDDo':
                        if (number === 1) {
                            return number + '-ին';
                        }
                        return number + '-րդ';
                    default:
                        return number;
                }
            },

            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Bahasa Indonesia (id)
    // author : Mohammad Satrio Utomo : https://github.com/tyok
    // reference: http://id.wikisource.org/wiki/Pedoman_Umum_Ejaan_Bahasa_Indonesia_yang_Disempurnakan

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('id', {
            months: 'Januari_Februari_Maret_April_Mei_Juni_Juli_Agustus_September_Oktober_November_Desember'.split('_'),
            monthsShort: 'Jan_Feb_Mar_Apr_Mei_Jun_Jul_Ags_Sep_Okt_Nov_Des'.split('_'),
            weekdays: 'Minggu_Senin_Selasa_Rabu_Kamis_Jumat_Sabtu'.split('_'),
            weekdaysShort: 'Min_Sen_Sel_Rab_Kam_Jum_Sab'.split('_'),
            weekdaysMin: 'Mg_Sn_Sl_Rb_Km_Jm_Sb'.split('_'),
            longDateFormat: {
                LT: 'HH.mm',
                LTS: 'LT.ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY [pukul] LT',
                LLLL: 'dddd, D MMMM YYYY [pukul] LT'
            },
            meridiemParse: /pagi|siang|sore|malam/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'pagi') {
                    return hour;
                } else if (meridiem === 'siang') {
                    return hour >= 11 ? hour : hour + 12;
                } else if (meridiem === 'sore' || meridiem === 'malam') {
                    return hour + 12;
                }
            },
            meridiem: function (hours, minutes, isLower) {
                if (hours < 11) {
                    return 'pagi';
                } else if (hours < 15) {
                    return 'siang';
                } else if (hours < 19) {
                    return 'sore';
                } else {
                    return 'malam';
                }
            },
            calendar: {
                sameDay: '[Hari ini pukul] LT',
                nextDay: '[Besok pukul] LT',
                nextWeek: 'dddd [pukul] LT',
                lastDay: '[Kemarin pukul] LT',
                lastWeek: 'dddd [lalu pukul] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'dalam %s',
                past: '%s yang lalu',
                s: 'beberapa detik',
                m: 'semenit',
                mm: '%d menit',
                h: 'sejam',
                hh: '%d jam',
                d: 'sehari',
                dd: '%d hari',
                M: 'sebulan',
                MM: '%d bulan',
                y: 'setahun',
                yy: '%d tahun'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : icelandic (is)
    // author : Hinrik Örn Sigurðsson : https://github.com/hinrik

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function plural(n) {
            if (n % 100 === 11) {
                return true;
            } else if (n % 10 === 1) {
                return false;
            }
            return true;
        }

        function translate(number, withoutSuffix, key, isFuture) {
            var result = number + ' ';
            switch (key) {
                case 's':
                    return withoutSuffix || isFuture ? 'nokkrar sekúndur' : 'nokkrum sekúndum';
                case 'm':
                    return withoutSuffix ? 'mínúta' : 'mínútu';
                case 'mm':
                    if (plural(number)) {
                        return result + (withoutSuffix || isFuture ? 'mínútur' : 'mínútum');
                    } else if (withoutSuffix) {
                        return result + 'mínúta';
                    }
                    return result + 'mínútu';
                case 'hh':
                    if (plural(number)) {
                        return result + (withoutSuffix || isFuture ? 'klukkustundir' : 'klukkustundum');
                    }
                    return result + 'klukkustund';
                case 'd':
                    if (withoutSuffix) {
                        return 'dagur';
                    }
                    return isFuture ? 'dag' : 'degi';
                case 'dd':
                    if (plural(number)) {
                        if (withoutSuffix) {
                            return result + 'dagar';
                        }
                        return result + (isFuture ? 'daga' : 'dögum');
                    } else if (withoutSuffix) {
                        return result + 'dagur';
                    }
                    return result + (isFuture ? 'dag' : 'degi');
                case 'M':
                    if (withoutSuffix) {
                        return 'mánuður';
                    }
                    return isFuture ? 'mánuð' : 'mánuði';
                case 'MM':
                    if (plural(number)) {
                        if (withoutSuffix) {
                            return result + 'mánuðir';
                        }
                        return result + (isFuture ? 'mánuði' : 'mánuðum');
                    } else if (withoutSuffix) {
                        return result + 'mánuður';
                    }
                    return result + (isFuture ? 'mánuð' : 'mánuði');
                case 'y':
                    return withoutSuffix || isFuture ? 'ár' : 'ári';
                case 'yy':
                    if (plural(number)) {
                        return result + (withoutSuffix || isFuture ? 'ár' : 'árum');
                    }
                    return result + (withoutSuffix || isFuture ? 'ár' : 'ári');
            }
        }

        return moment.defineLocale('is', {
            months: 'janúar_febrúar_mars_apríl_maí_júní_júlí_ágúst_september_október_nóvember_desember'.split('_'),
            monthsShort: 'jan_feb_mar_apr_maí_jún_júl_ágú_sep_okt_nóv_des'.split('_'),
            weekdays: 'sunnudagur_mánudagur_þriðjudagur_miðvikudagur_fimmtudagur_föstudagur_laugardagur'.split('_'),
            weekdaysShort: 'sun_mán_þri_mið_fim_fös_lau'.split('_'),
            weekdaysMin: 'Su_Má_Þr_Mi_Fi_Fö_La'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY [kl.] LT',
                LLLL: 'dddd, D. MMMM YYYY [kl.] LT'
            },
            calendar: {
                sameDay: '[í dag kl.] LT',
                nextDay: '[á morgun kl.] LT',
                nextWeek: 'dddd [kl.] LT',
                lastDay: '[í gær kl.] LT',
                lastWeek: '[síðasta] dddd [kl.] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'eftir %s',
                past: 'fyrir %s síðan',
                s: translate,
                m: translate,
                mm: translate,
                h: 'klukkustund',
                hh: translate,
                d: translate,
                dd: translate,
                M: translate,
                MM: translate,
                y: translate,
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : italian (it)
    // author : Lorenzo : https://github.com/aliem
    // author: Mattia Larentis: https://github.com/nostalgiaz

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('it', {
            months: 'gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre'.split('_'),
            monthsShort: 'gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic'.split('_'),
            weekdays: 'Domenica_Lunedì_Martedì_Mercoledì_Giovedì_Venerdì_Sabato'.split('_'),
            weekdaysShort: 'Dom_Lun_Mar_Mer_Gio_Ven_Sab'.split('_'),
            weekdaysMin: 'D_L_Ma_Me_G_V_S'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Oggi alle] LT',
                nextDay: '[Domani alle] LT',
                nextWeek: 'dddd [alle] LT',
                lastDay: '[Ieri alle] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[la scorsa] dddd [alle] LT';
                        default:
                            return '[lo scorso] dddd [alle] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: function (s) {
                    return ((/^[0-9].+$/).test(s) ? 'tra' : 'in') + ' ' + s;
                },
                past: '%s fa',
                s: 'alcuni secondi',
                m: 'un minuto',
                mm: '%d minuti',
                h: 'un\'ora',
                hh: '%d ore',
                d: 'un giorno',
                dd: '%d giorni',
                M: 'un mese',
                MM: '%d mesi',
                y: 'un anno',
                yy: '%d anni'
            },
            ordinalParse: /\d{1,2}º/,
            ordinal: '%dº',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : japanese (ja)
    // author : LI Long : https://github.com/baryon

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ja', {
            months: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
            monthsShort: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
            weekdays: '日曜日_月曜日_火曜日_水曜日_木曜日_金曜日_土曜日'.split('_'),
            weekdaysShort: '日_月_火_水_木_金_土'.split('_'),
            weekdaysMin: '日_月_火_水_木_金_土'.split('_'),
            longDateFormat: {
                LT: 'Ah時m分',
                LTS: 'LTs秒',
                L: 'YYYY/MM/DD',
                LL: 'YYYY年M月D日',
                LLL: 'YYYY年M月D日LT',
                LLLL: 'YYYY年M月D日LT dddd'
            },
            meridiemParse: /午前|午後/i,
            isPM: function (input) {
                return input === '午後';
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 12) {
                    return '午前';
                } else {
                    return '午後';
                }
            },
            calendar: {
                sameDay: '[今日] LT',
                nextDay: '[明日] LT',
                nextWeek: '[来週]dddd LT',
                lastDay: '[昨日] LT',
                lastWeek: '[前週]dddd LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s後',
                past: '%s前',
                s: '数秒',
                m: '1分',
                mm: '%d分',
                h: '1時間',
                hh: '%d時間',
                d: '1日',
                dd: '%d日',
                M: '1ヶ月',
                MM: '%dヶ月',
                y: '1年',
                yy: '%d年'
            }
        });
    }));
    // moment.js locale configuration
    // locale : Georgian (ka)
    // author : Irakli Janiashvili : https://github.com/irakli-janiashvili

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function monthsCaseReplace(m, format) {
            var months = {
                'nominative': 'იანვა� ი_თებე� ვალი_მა� ტი_აპ� ილი_მაისი_ივნისი_ივლისი_აგვისტო_სექტემბე� ი_ოქტომბე� ი_ნოემბე� ი_დეკემბე� ი'.split('_'),
                'accusative': 'იანვა� ს_თებე� ვალს_მა� ტს_აპ� ილის_მაისს_ივნისს_ივლისს_აგვისტს_სექტემბე� ს_ოქტომბე� ს_ნოემბე� ს_დეკემბე� ს'.split('_')
            },

            nounCase = (/D[oD] *MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return months[nounCase][m.month()];
        }

        function weekdaysCaseReplace(m, format) {
            var weekdays = {
                'nominative': 'კვი� ა_ო� შაბათი_სამშაბათი_ოთხშაბათი_ხუთშაბათი_პა� ასკევი_შაბათი'.split('_'),
                'accusative': 'კვი� ას_ო� შაბათს_სამშაბათს_ოთხშაბათს_ხუთშაბათს_პა� ასკევს_შაბათს'.split('_')
            },

            nounCase = (/(წინა|შემდეგ)/).test(format) ?
                'accusative' :
                'nominative';

            return weekdays[nounCase][m.day()];
        }

        return moment.defineLocale('ka', {
            months: monthsCaseReplace,
            monthsShort: 'იან_თებ_მა� _აპ� _მაი_ივნ_ივლ_აგვ_სექ_ოქტ_ნოე_დეკ'.split('_'),
            weekdays: weekdaysCaseReplace,
            weekdaysShort: 'კვი_ო� შ_სამ_ოთხ_ხუთ_პა� _შაბ'.split('_'),
            weekdaysMin: 'კვ_ო� _სა_ოთ_ხუ_პა_შა'.split('_'),
            longDateFormat: {
                LT: 'h:mm A',
                LTS: 'h:mm:ss A',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[დღეს] LT[-ზე]',
                nextDay: '[ხვალ] LT[-ზე]',
                lastDay: '[გუშინ] LT[-ზე]',
                nextWeek: '[შემდეგ] dddd LT[-ზე]',
                lastWeek: '[წინა] dddd LT-ზე',
                sameElse: 'L'
            },
            relativeTime: {
                future: function (s) {
                    return (/(წამი|წუთი|საათი|წელი)/).test(s) ?
                        s.replace(/ი$/, 'ში') :
                        s + 'ში';
                },
                past: function (s) {
                    if ((/(წამი|წუთი|საათი|დღე|თვე)/).test(s)) {
                        return s.replace(/(ი|ე)$/, 'ის წინ');
                    }
                    if ((/წელი/).test(s)) {
                        return s.replace(/წელი$/, 'წლის წინ');
                    }
                },
                s: '� ამდენიმე წამი',
                m: 'წუთი',
                mm: '%d წუთი',
                h: 'საათი',
                hh: '%d საათი',
                d: 'დღე',
                dd: '%d დღე',
                M: 'თვე',
                MM: '%d თვე',
                y: 'წელი',
                yy: '%d წელი'
            },
            ordinalParse: /0|1-ლი|მე-\d{1,2}|\d{1,2}-ე/,
            ordinal: function (number) {
                if (number === 0) {
                    return number;
                }

                if (number === 1) {
                    return number + '-ლი';
                }

                if ((number < 20) || (number <= 100 && (number % 20 === 0)) || (number % 100 === 0)) {
                    return 'მე-' + number;
                }

                return number + '-ე';
            },
            week: {
                dow: 1,
                doy: 7
            }
        });
    }));
    // moment.js locale configuration
    // locale : khmer (km)
    // author : Kruy Vanna : https://github.com/kruyvanna

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('km', {
            months: 'មករា_កុម្ភៈ_មិនា_មេសា_ឧសភា_មិថុនា_កក្កដា_សី� ា_កញ្ញា_តុលា_វិច្ឆិកា_ធ្នូ'.split('_'),
            monthsShort: 'មករា_កុម្ភៈ_មិនា_មេសា_ឧសភា_មិថុនា_កក្កដា_សី� ា_កញ្ញា_តុលា_វិច្ឆិកា_ធ្នូ'.split('_'),
            weekdays: 'អាទិត្យ_ច័ន្ទ_អង្គារ_ពុធ_ព្រ� ស្បតិ៍_សុក្រ_សៅរ៍'.split('_'),
            weekdaysShort: 'អាទិត្យ_ច័ន្ទ_អង្គារ_ពុធ_ព្រ� ស្បតិ៍_សុក្រ_សៅរ៍'.split('_'),
            weekdaysMin: 'អាទិត្យ_ច័ន្ទ_អង្គារ_ពុធ_ព្រ� ស្បតិ៍_សុក្រ_សៅរ៍'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[ថ្ងៃនៈ ម៉ោង] LT',
                nextDay: '[ស្អែក ម៉ោង] LT',
                nextWeek: 'dddd [ម៉ោង] LT',
                lastDay: '[ម្សិលមិញ ម៉ោង] LT',
                lastWeek: 'dddd [សប្តា� ៍មុន] [ម៉ោង] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%sទៀត',
                past: '%sមុន',
                s: 'ប៉ុន្មានវិនាទី',
                m: 'មួយនាទី',
                mm: '%d នាទី',
                h: 'មួយម៉ោង',
                hh: '%d ម៉ោង',
                d: 'មួយថ្ងៃ',
                dd: '%d ថ្ងៃ',
                M: 'មួយខែ',
                MM: '%d ខែ',
                y: 'មួយឆ្នាំ',
                yy: '%d ឆ្នាំ'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4 // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : korean (ko)
    //
    // authors
    //
    // - Kyungwook, Park : https://github.com/kyungw00k
    // - Jeeeyul Lee <jeeeyul@gmail.com>
    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ko', {
            months: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
            monthsShort: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
            weekdays: '일요일_월요일_화요일_수요일_목요일_금요일_� 요일'.split('_'),
            weekdaysShort: '일_월_화_수_목_금_� '.split('_'),
            weekdaysMin: '일_월_화_수_목_금_� '.split('_'),
            longDateFormat: {
                LT: 'A h시 m분',
                LTS: 'A h시 m분 s초',
                L: 'YYYY.MM.DD',
                LL: 'YYYY년 MMMM D일',
                LLL: 'YYYY년 MMMM D일 LT',
                LLLL: 'YYYY년 MMMM D일 dddd LT'
            },
            calendar: {
                sameDay: '오늘 LT',
                nextDay: '내일 LT',
                nextWeek: 'dddd LT',
                lastDay: '어� � LT',
                lastWeek: '지난주 dddd LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s 후',
                past: '%s � �',
                s: '몇초',
                ss: '%d초',
                m: '일분',
                mm: '%d분',
                h: '한시간',
                hh: '%d시간',
                d: '하루',
                dd: '%d일',
                M: '한달',
                MM: '%d달',
                y: '일년',
                yy: '%d년'
            },
            ordinalParse: /\d{1,2}일/,
            ordinal: '%d일',
            meridiemParse: /오� �|오후/,
            isPM: function (token) {
                return token === '오후';
            },
            meridiem: function (hour, minute, isUpper) {
                return hour < 12 ? '오� �' : '오후';
            }
        });
    }));
    // moment.js locale configuration
    // locale : Luxembourgish (lb)
    // author : mweimerskirch : https://github.com/mweimerskirch, David Raison : https://github.com/kwisatz

    // Note: Luxembourgish has a very particular phonological rule ('Eifeler Regel') that causes the
    // deletion of the final 'n' in certain contexts. That's what the 'eifelerRegelAppliesToWeekday'
    // and 'eifelerRegelAppliesToNumber' methods are meant for

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function processRelativeTime(number, withoutSuffix, key, isFuture) {
            var format = {
                'm': ['eng Minutt', 'enger Minutt'],
                'h': ['eng Stonn', 'enger Stonn'],
                'd': ['een Dag', 'engem Dag'],
                'M': ['ee Mount', 'engem Mount'],
                'y': ['ee Joer', 'engem Joer']
            };
            return withoutSuffix ? format[key][0] : format[key][1];
        }

        function processFutureTime(string) {
            var number = string.substr(0, string.indexOf(' '));
            if (eifelerRegelAppliesToNumber(number)) {
                return 'a ' + string;
            }
            return 'an ' + string;
        }

        function processPastTime(string) {
            var number = string.substr(0, string.indexOf(' '));
            if (eifelerRegelAppliesToNumber(number)) {
                return 'viru ' + string;
            }
            return 'virun ' + string;
        }

        /**
         * Returns true if the word before the given number loses the '-n' ending.
         * e.g. 'an 10 Deeg' but 'a 5 Deeg'
         *
         * @param number {integer}
         * @returns {boolean}
         */
        function eifelerRegelAppliesToNumber(number) {
            number = parseInt(number, 10);
            if (isNaN(number)) {
                return false;
            }
            if (number < 0) {
                // Negative Number --> always true
                return true;
            } else if (number < 10) {
                // Only 1 digit
                if (4 <= number && number <= 7) {
                    return true;
                }
                return false;
            } else if (number < 100) {
                // 2 digits
                var lastDigit = number % 10, firstDigit = number / 10;
                if (lastDigit === 0) {
                    return eifelerRegelAppliesToNumber(firstDigit);
                }
                return eifelerRegelAppliesToNumber(lastDigit);
            } else if (number < 10000) {
                // 3 or 4 digits --> recursively check first digit
                while (number >= 10) {
                    number = number / 10;
                }
                return eifelerRegelAppliesToNumber(number);
            } else {
                // Anything larger than 4 digits: recursively check first n-3 digits
                number = number / 1000;
                return eifelerRegelAppliesToNumber(number);
            }
        }

        return moment.defineLocale('lb', {
            months: 'Januar_Februar_Mäerz_Abrëll_Mee_Juni_Juli_August_September_Oktober_November_Dezember'.split('_'),
            monthsShort: 'Jan._Febr._Mrz._Abr._Mee_Jun._Jul._Aug._Sept._Okt._Nov._Dez.'.split('_'),
            weekdays: 'Sonndeg_Méindeg_Dënschdeg_Mëttwoch_Donneschdeg_Freideg_Samschdeg'.split('_'),
            weekdaysShort: 'So._Mé._Dë._Më._Do._Fr._Sa.'.split('_'),
            weekdaysMin: 'So_Mé_Dë_Më_Do_Fr_Sa'.split('_'),
            longDateFormat: {
                LT: 'H:mm [Auer]',
                LTS: 'H:mm:ss [Auer]',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Haut um] LT',
                sameElse: 'L',
                nextDay: '[Muer um] LT',
                nextWeek: 'dddd [um] LT',
                lastDay: '[Gëschter um] LT',
                lastWeek: function () {
                    // Different date string for 'Dënschdeg' (Tuesday) and 'Donneschdeg' (Thursday) due to phonological rule
                    switch (this.day()) {
                        case 2:
                        case 4:
                            return '[Leschten] dddd [um] LT';
                        default:
                            return '[Leschte] dddd [um] LT';
                    }
                }
            },
            relativeTime: {
                future: processFutureTime,
                past: processPastTime,
                s: 'e puer Sekonnen',
                m: processRelativeTime,
                mm: '%d Minutten',
                h: processRelativeTime,
                hh: '%d Stonnen',
                d: processRelativeTime,
                dd: '%d Deeg',
                M: processRelativeTime,
                MM: '%d Méint',
                y: processRelativeTime,
                yy: '%d Joer'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Lithuanian (lt)
    // author : Mindaugas Mozūras : https://github.com/mmozuras

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var units = {
            'm': 'minutė_minutės_minutę',
            'mm': 'minutės_minučių_minutes',
            'h': 'valanda_valandos_valandą',
            'hh': 'valandos_valandų_valandas',
            'd': 'diena_dienos_dieną',
            'dd': 'dienos_dienų_dienas',
            'M': 'mėnuo_mėnesio_mėnesį',
            'MM': 'mėnesiai_mėnesių_mėnesius',
            'y': 'metai_metų_metus',
            'yy': 'metai_metų_metus'
        },
        weekDays = 'sekmadienis_pirmadienis_antradienis_trečiadienis_ketvirtadienis_penktadienis_šeštadienis'.split('_');

        function translateSeconds(number, withoutSuffix, key, isFuture) {
            if (withoutSuffix) {
                return 'kelios sekundės';
            } else {
                return isFuture ? 'kelių sekundžių' : 'kelias sekundes';
            }
        }

        function translateSingular(number, withoutSuffix, key, isFuture) {
            return withoutSuffix ? forms(key)[0] : (isFuture ? forms(key)[1] : forms(key)[2]);
        }

        function special(number) {
            return number % 10 === 0 || (number > 10 && number < 20);
        }

        function forms(key) {
            return units[key].split('_');
        }

        function translate(number, withoutSuffix, key, isFuture) {
            var result = number + ' ';
            if (number === 1) {
                return result + translateSingular(number, withoutSuffix, key[0], isFuture);
            } else if (withoutSuffix) {
                return result + (special(number) ? forms(key)[1] : forms(key)[0]);
            } else {
                if (isFuture) {
                    return result + forms(key)[1];
                } else {
                    return result + (special(number) ? forms(key)[1] : forms(key)[2]);
                }
            }
        }

        function relativeWeekDay(moment, format) {
            var nominative = format.indexOf('dddd HH:mm') === -1,
                weekDay = weekDays[moment.day()];

            return nominative ? weekDay : weekDay.substring(0, weekDay.length - 2) + 'į';
        }

        return moment.defineLocale('lt', {
            months: 'sausio_vasario_kovo_balandžio_gegužės_birželio_liepos_rugpjūčio_rugsėjo_spalio_lapkričio_gruodžio'.split('_'),
            monthsShort: 'sau_vas_kov_bal_geg_bir_lie_rgp_rgs_spa_lap_grd'.split('_'),
            weekdays: relativeWeekDay,
            weekdaysShort: 'Sek_Pir_Ant_Tre_Ket_Pen_� eš'.split('_'),
            weekdaysMin: 'S_P_A_T_K_Pn_� '.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'YYYY-MM-DD',
                LL: 'YYYY [m.] MMMM D [d.]',
                LLL: 'YYYY [m.] MMMM D [d.], LT [val.]',
                LLLL: 'YYYY [m.] MMMM D [d.], dddd, LT [val.]',
                l: 'YYYY-MM-DD',
                ll: 'YYYY [m.] MMMM D [d.]',
                lll: 'YYYY [m.] MMMM D [d.], LT [val.]',
                llll: 'YYYY [m.] MMMM D [d.], ddd, LT [val.]'
            },
            calendar: {
                sameDay: '[� iandien] LT',
                nextDay: '[Rytoj] LT',
                nextWeek: 'dddd LT',
                lastDay: '[Vakar] LT',
                lastWeek: '[Praėjusį] dddd LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'po %s',
                past: 'prieš %s',
                s: translateSeconds,
                m: translateSingular,
                mm: translate,
                h: translateSingular,
                hh: translate,
                d: translateSingular,
                dd: translate,
                M: translateSingular,
                MM: translate,
                y: translateSingular,
                yy: translate
            },
            ordinalParse: /\d{1,2}-oji/,
            ordinal: function (number) {
                return number + '-oji';
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : latvian (lv)
    // author : Kristaps Karlsons : https://github.com/skakri

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var units = {
            'mm': 'minūti_minūtes_minūte_minūtes',
            'hh': 'stundu_stundas_stunda_stundas',
            'dd': 'dienu_dienas_diena_dienas',
            'MM': 'mēnesi_mēnešus_mēnesis_mēneši',
            'yy': 'gadu_gadus_gads_gadi'
        };

        function format(word, number, withoutSuffix) {
            var forms = word.split('_');
            if (withoutSuffix) {
                return number % 10 === 1 && number !== 11 ? forms[2] : forms[3];
            } else {
                return number % 10 === 1 && number !== 11 ? forms[0] : forms[1];
            }
        }

        function relativeTimeWithPlural(number, withoutSuffix, key) {
            return number + ' ' + format(units[key], number, withoutSuffix);
        }

        return moment.defineLocale('lv', {
            months: 'janvāris_februāris_marts_aprīlis_maijs_jūnijs_jūlijs_augusts_septembris_oktobris_novembris_decembris'.split('_'),
            monthsShort: 'jan_feb_mar_apr_mai_jūn_jūl_aug_sep_okt_nov_dec'.split('_'),
            weekdays: 'svētdiena_pirmdiena_otrdiena_trešdiena_ceturtdiena_piektdiena_sestdiena'.split('_'),
            weekdaysShort: 'Sv_P_O_T_C_Pk_S'.split('_'),
            weekdaysMin: 'Sv_P_O_T_C_Pk_S'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'YYYY. [gada] D. MMMM',
                LLL: 'YYYY. [gada] D. MMMM, LT',
                LLLL: 'YYYY. [gada] D. MMMM, dddd, LT'
            },
            calendar: {
                sameDay: '[� odien pulksten] LT',
                nextDay: '[Rīt pulksten] LT',
                nextWeek: 'dddd [pulksten] LT',
                lastDay: '[Vakar pulksten] LT',
                lastWeek: '[Pagājušā] dddd [pulksten] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s vēlāk',
                past: '%s agrāk',
                s: 'dažas sekundes',
                m: 'minūti',
                mm: relativeTimeWithPlural,
                h: 'stundu',
                hh: relativeTimeWithPlural,
                d: 'dienu',
                dd: relativeTimeWithPlural,
                M: 'mēnesi',
                MM: relativeTimeWithPlural,
                y: 'gadu',
                yy: relativeTimeWithPlural
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : macedonian (mk)
    // author : Borislav Mickov : https://github.com/B0k0

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('mk', {
            months: 'јануари_февруари_март_април_мај_јуни_јули_август_септември_октомври_ноември_декември'.split('_'),
            monthsShort: 'јан_фев_мар_апр_мај_јун_јул_авг_сеп_окт_ное_дек'.split('_'),
            weekdays: 'недела_понеделник_вторник_среда_четврток_петок_сабота'.split('_'),
            weekdaysShort: 'нед_пон_вто_сре_чет_пет_саб'.split('_'),
            weekdaysMin: 'нe_пo_вт_ср_че_пе_сa'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'D.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Денес во] LT',
                nextDay: '[Утре во] LT',
                nextWeek: 'dddd [во] LT',
                lastDay: '[Вчера во] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                        case 6:
                            return '[Во изминатата] dddd [во] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[Во изминатиот] dddd [во] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'после %s',
                past: 'пред %s',
                s: 'неколку секунди',
                m: 'минута',
                mm: '%d минути',
                h: 'час',
                hh: '%d часа',
                d: 'ден',
                dd: '%d дена',
                M: 'месец',
                MM: '%d месеци',
                y: 'година',
                yy: '%d години'
            },
            ordinalParse: /\d{1,2}-(ев|ен|ти|ви|ри|ми)/,
            ordinal: function (number) {
                var lastDigit = number % 10,
                    last2Digits = number % 100;
                if (number === 0) {
                    return number + '-ев';
                } else if (last2Digits === 0) {
                    return number + '-ен';
                } else if (last2Digits > 10 && last2Digits < 20) {
                    return number + '-ти';
                } else if (lastDigit === 1) {
                    return number + '-ви';
                } else if (lastDigit === 2) {
                    return number + '-ри';
                } else if (lastDigit === 7 || lastDigit === 8) {
                    return number + '-ми';
                } else {
                    return number + '-ти';
                }
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : malayalam (ml)
    // author : Floyd Pink : https://github.com/floydpink

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ml', {
            months: 'ജനുവരി_ഫെബ്രുവരി_മാർച്ച്_ഏപ്രിൽ_മേയ്_ജൂൺ_ജൂലൈ_ഓഗസ്റ്റ്_സെപ്റ്റംബർ_ഒക്ടോബർ_നവംബർ_ഡിസംബർ'.split('_'),
            monthsShort: 'ജനു._ഫെബ്രു._മാർ._ഏപ്രി._മേയ്_ജൂൺ_ജൂലൈ._ഓഗ._സെപ്റ്റ._ഒക്ടോ._നവം._ഡിസം.'.split('_'),
            weekdays: 'ഞായറാഴ്ച_തിങ്കളാഴ്ച_ചൊവ്വാഴ്ച_ബുധനാഴ്ച_വ്യാഴാഴ്ച_വെള്ളിയാഴ്ച_ശനിയാഴ്ച'.split('_'),
            weekdaysShort: 'ഞായർ_തിങ്കൾ_ചൊവ്വ_ബുധൻ_വ്യാഴം_വെള്ളി_ശനി'.split('_'),
            weekdaysMin: 'ഞാ_തി_ചൊ_ബു_വ്യാ_വെ_ശ'.split('_'),
            longDateFormat: {
                LT: 'A h:mm -നു',
                LTS: 'A h:mm:ss -നു',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[ഇന്ന്] LT',
                nextDay: '[നാളെ] LT',
                nextWeek: 'dddd, LT',
                lastDay: '[ഇന്നലെ] LT',
                lastWeek: '[കഴിഞ്ഞ] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s കഴിഞ്ഞ്',
                past: '%s മുൻപ്',
                s: 'അൽപ നിമിഷങ്ങൾ',
                m: 'ഒരു മിനിറ്റ്',
                mm: '%d മിനിറ്റ്',
                h: 'ഒരു മണിക്കൂർ',
                hh: '%d മണിക്കൂർ',
                d: 'ഒരു ദിവസം',
                dd: '%d ദിവസം',
                M: 'ഒരു മാസം',
                MM: '%d മാസം',
                y: 'ഒരു വർഷം',
                yy: '%d വർഷം'
            },
            meridiemParse: /രാത്രി|രാവിലെ|ഉച്ച കഴിഞ്ഞ്|വൈകുന്നേരം|രാത്രി/i,
            isPM: function (input) {
                return /^(ഉച്ച കഴിഞ്ഞ്|വൈകുന്നേരം|രാത്രി)$/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'രാത്രി';
                } else if (hour < 12) {
                    return 'രാവിലെ';
                } else if (hour < 17) {
                    return 'ഉച്ച കഴിഞ്ഞ്';
                } else if (hour < 20) {
                    return 'വൈകുന്നേരം';
                } else {
                    return 'രാത്രി';
                }
            }
        });
    }));
    // moment.js locale configuration
    // locale : Marathi (mr)
    // author : Harshad Kale : https://github.com/kalehv

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '१',
            '2': '२',
            '3': '३',
            '4': '४',
            '5': '५',
            '6': '६',
            '7': '७',
            '8': '८',
            '9': '९',
            '0': '०'
        },
        numberMap = {
            '१': '1',
            '२': '2',
            '३': '3',
            '४': '4',
            '५': '5',
            '६': '6',
            '७': '7',
            '८': '8',
            '९': '9',
            '०': '0'
        };

        return moment.defineLocale('mr', {
            months: 'जानेवारी_फेब्रुवारी_मार्च_एप्रिल_मे_जून_जुलै_ऑगस्ट_सप्टेंबर_ऑक्टोबर_नोव्हेंबर_डिसेंबर'.split('_'),
            monthsShort: 'जाने._फेब्रु._मार्च._एप्रि._मे._जून._जुलै._ऑग._सप्टें._ऑक्टो._नोव्हें._डिसें.'.split('_'),
            weekdays: 'रविवार_सोमवार_मंगळवार_बुधवार_गुरूवार_शुक्रवार_शनिवार'.split('_'),
            weekdaysShort: 'रवि_सोम_मंगळ_बुध_गुरू_शुक्र_शनि'.split('_'),
            weekdaysMin: 'र_सो_मं_बु_गु_शु_श'.split('_'),
            longDateFormat: {
                LT: 'A h:mm वाजता',
                LTS: 'A h:mm:ss वाजता',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[आज] LT',
                nextDay: '[उद्या] LT',
                nextWeek: 'dddd, LT',
                lastDay: '[काल] LT',
                lastWeek: '[मागील] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s नंतर',
                past: '%s पूर्वी',
                s: 'सेकंद',
                m: 'एक मिनिट',
                mm: '%d मिनिटे',
                h: 'एक तास',
                hh: '%d तास',
                d: 'एक दिवस',
                dd: '%d दिवस',
                M: 'एक महिना',
                MM: '%d महिने',
                y: 'एक वर्ष',
                yy: '%d वर्षे'
            },
            preparse: function (string) {
                return string.replace(/[१२३४५६७८९०]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            meridiemParse: /रात्री|सकाळी|दुपारी|सायंकाळी/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'रात्री') {
                    return hour < 4 ? hour : hour + 12;
                } else if (meridiem === 'सकाळी') {
                    return hour;
                } else if (meridiem === 'दुपारी') {
                    return hour >= 10 ? hour : hour + 12;
                } else if (meridiem === 'सायंकाळी') {
                    return hour + 12;
                }
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'रात्री';
                } else if (hour < 10) {
                    return 'सकाळी';
                } else if (hour < 17) {
                    return 'दुपारी';
                } else if (hour < 20) {
                    return 'सायंकाळी';
                } else {
                    return 'रात्री';
                }
            },
            week: {
                dow: 0, // Sunday is the first day of the week.
                doy: 6  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Bahasa Malaysia (ms-MY)
    // author : Weldan Jamili : https://github.com/weldan

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('ms-my', {
            months: 'Januari_Februari_Mac_April_Mei_Jun_Julai_Ogos_September_Oktober_November_Disember'.split('_'),
            monthsShort: 'Jan_Feb_Mac_Apr_Mei_Jun_Jul_Ogs_Sep_Okt_Nov_Dis'.split('_'),
            weekdays: 'Ahad_Isnin_Selasa_Rabu_Khamis_Jumaat_Sabtu'.split('_'),
            weekdaysShort: 'Ahd_Isn_Sel_Rab_Kha_Jum_Sab'.split('_'),
            weekdaysMin: 'Ah_Is_Sl_Rb_Km_Jm_Sb'.split('_'),
            longDateFormat: {
                LT: 'HH.mm',
                LTS: 'LT.ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY [pukul] LT',
                LLLL: 'dddd, D MMMM YYYY [pukul] LT'
            },
            meridiemParse: /pagi|tengahari|petang|malam/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'pagi') {
                    return hour;
                } else if (meridiem === 'tengahari') {
                    return hour >= 11 ? hour : hour + 12;
                } else if (meridiem === 'petang' || meridiem === 'malam') {
                    return hour + 12;
                }
            },
            meridiem: function (hours, minutes, isLower) {
                if (hours < 11) {
                    return 'pagi';
                } else if (hours < 15) {
                    return 'tengahari';
                } else if (hours < 19) {
                    return 'petang';
                } else {
                    return 'malam';
                }
            },
            calendar: {
                sameDay: '[Hari ini pukul] LT',
                nextDay: '[Esok pukul] LT',
                nextWeek: 'dddd [pukul] LT',
                lastDay: '[Kelmarin pukul] LT',
                lastWeek: 'dddd [lepas pukul] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'dalam %s',
                past: '%s yang lepas',
                s: 'beberapa saat',
                m: 'seminit',
                mm: '%d minit',
                h: 'sejam',
                hh: '%d jam',
                d: 'sehari',
                dd: '%d hari',
                M: 'sebulan',
                MM: '%d bulan',
                y: 'setahun',
                yy: '%d tahun'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Burmese (my)
    // author : Squar team, mysquar.com

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '၁',
            '2': '၂',
            '3': '၃',
            '4': '၄',
            '5': '၅',
            '6': '၆',
            '7': '၇',
            '8': '၈',
            '9': '၉',
            '0': '၀'
        }, numberMap = {
            '၁': '1',
            '၂': '2',
            '၃': '3',
            '၄': '4',
            '၅': '5',
            '၆': '6',
            '၇': '7',
            '၈': '8',
            '၉': '9',
            '၀': '0'
        };
        return moment.defineLocale('my', {
            months: 'ဇန်နဝါရီ_ဖေဖော်ဝါရီ_မတ်_ဧပြီ_မေ_ဇွန်_ဇူလိုင်_သြဂုတ်_စက်တင်ဘာ_အောက်တိုဘာ_နိုဝင်ဘာ_ဒီဇင်ဘာ'.split('_'),
            monthsShort: 'ဇန်_ဖေ_မတ်_ပြီ_မေ_ဇွန်_လိုင်_သြ_စက်_အောက်_နို_ဒီ'.split('_'),
            weekdays: 'တနင်္ဂနွေ_တနင်္လာ_အင်္ဂါ_ဗုဒ္ဓဟူး_ကြာသပတေး_သောကြာ_စနေ'.split('_'),
            weekdaysShort: 'နွေ_လာ_င်္ဂါ_ဟူး_ကြာ_သော_နေ'.split('_'),
            weekdaysMin: 'နွေ_လာ_င်္ဂါ_ဟူး_ကြာ_သော_နေ'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[ယနေ.] LT [မှာ]',
                nextDay: '[မနက်ဖြန်] LT [မှာ]',
                nextWeek: 'dddd LT [မှာ]',
                lastDay: '[မနေ.က] LT [မှာ]',
                lastWeek: '[ပြီးခဲ့သော] dddd LT [မှာ]',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'လာမည့် %s မှာ',
                past: 'လွန်ခဲ့သော %s က',
                s: 'စက္ကန်.အနည်းငယ်',
                m: 'တစ်မိနစ်',
                mm: '%d မိနစ်',
                h: 'တစ်နာရီ',
                hh: '%d နာရီ',
                d: 'တစ်ရက်',
                dd: '%d ရက်',
                M: 'တစ်လ',
                MM: '%d လ',
                y: 'တစ်နှစ်',
                yy: '%d နှစ်'
            },
            preparse: function (string) {
                return string.replace(/[၁၂၃၄၅၆၇၈၉၀]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4 // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : norwegian bokmål (nb)
    // authors : Espen Hovlandsdal : https://github.com/rexxars
    //           Sigurd Gartmann : https://github.com/sigurdga

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('nb', {
            months: 'januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember'.split('_'),
            monthsShort: 'jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des'.split('_'),
            weekdays: 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
            weekdaysShort: 'søn_man_tirs_ons_tors_fre_lør'.split('_'),
            weekdaysMin: 'sø_ma_ti_on_to_fr_lø'.split('_'),
            longDateFormat: {
                LT: 'H.mm',
                LTS: 'LT.ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY [kl.] LT',
                LLLL: 'dddd D. MMMM YYYY [kl.] LT'
            },
            calendar: {
                sameDay: '[i dag kl.] LT',
                nextDay: '[i morgen kl.] LT',
                nextWeek: 'dddd [kl.] LT',
                lastDay: '[i går kl.] LT',
                lastWeek: '[forrige] dddd [kl.] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'om %s',
                past: 'for %s siden',
                s: 'noen sekunder',
                m: 'ett minutt',
                mm: '%d minutter',
                h: 'en time',
                hh: '%d timer',
                d: 'en dag',
                dd: '%d dager',
                M: 'en måned',
                MM: '%d måneder',
                y: 'ett år',
                yy: '%d år'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : nepali/nepalese
    // author : suvash : https://github.com/suvash

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var symbolMap = {
            '1': '१',
            '2': '२',
            '3': '३',
            '4': '४',
            '5': '५',
            '6': '६',
            '7': '७',
            '8': '८',
            '9': '९',
            '0': '०'
        },
        numberMap = {
            '१': '1',
            '२': '2',
            '३': '3',
            '४': '4',
            '५': '5',
            '६': '6',
            '७': '7',
            '८': '8',
            '९': '9',
            '०': '0'
        };

        return moment.defineLocale('ne', {
            months: 'जनवरी_फेब्रुवरी_मार्च_अप्रिल_मई_जुन_जुलाई_अगष्ट_सेप्टेम्बर_अक्टोबर_नोभेम्बर_डिसेम्बर'.split('_'),
            monthsShort: 'जन._फेब्रु._मार्च_अप्रि._मई_जुन_जुलाई._अग._सेप्ट._अक्टो._नोभे._डिसे.'.split('_'),
            weekdays: 'आइतबार_सोमबार_मङ्गलबार_बुधबार_बिहिबार_शुक्रबार_शनिबार'.split('_'),
            weekdaysShort: 'आइत._सोम._मङ्गल._बुध._बिहि._शुक्र._शनि.'.split('_'),
            weekdaysMin: 'आइ._सो._मङ्_बु._बि._शु._श.'.split('_'),
            longDateFormat: {
                LT: 'Aको h:mm बजे',
                LTS: 'Aको h:mm:ss बजे',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            preparse: function (string) {
                return string.replace(/[१२३४५६७८९०]/g, function (match) {
                    return numberMap[match];
                });
            },
            postformat: function (string) {
                return string.replace(/\d/g, function (match) {
                    return symbolMap[match];
                });
            },
            meridiemParse: /राती|बिहान|दिउँसो|बेलुका|साँझ|राती/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'राती') {
                    return hour < 3 ? hour : hour + 12;
                } else if (meridiem === 'बिहान') {
                    return hour;
                } else if (meridiem === 'दिउँसो') {
                    return hour >= 10 ? hour : hour + 12;
                } else if (meridiem === 'बेलुका' || meridiem === 'साँझ') {
                    return hour + 12;
                }
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 3) {
                    return 'राती';
                } else if (hour < 10) {
                    return 'बिहान';
                } else if (hour < 15) {
                    return 'दिउँसो';
                } else if (hour < 18) {
                    return 'बेलुका';
                } else if (hour < 20) {
                    return 'साँझ';
                } else {
                    return 'राती';
                }
            },
            calendar: {
                sameDay: '[आज] LT',
                nextDay: '[भोली] LT',
                nextWeek: '[आउँदो] dddd[,] LT',
                lastDay: '[हिजो] LT',
                lastWeek: '[गएको] dddd[,] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%sमा',
                past: '%s अगाडी',
                s: 'केही समय',
                m: 'एक मिनेट',
                mm: '%d मिनेट',
                h: 'एक घण्टा',
                hh: '%d घण्टा',
                d: 'एक दिन',
                dd: '%d दिन',
                M: 'एक महिना',
                MM: '%d महिना',
                y: 'एक बर्ष',
                yy: '%d बर्ष'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : dutch (nl)
    // author : Joris Röling : https://github.com/jjupiter

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var monthsShortWithDots = 'jan._feb._mrt._apr._mei_jun._jul._aug._sep._okt._nov._dec.'.split('_'),
            monthsShortWithoutDots = 'jan_feb_mrt_apr_mei_jun_jul_aug_sep_okt_nov_dec'.split('_');

        return moment.defineLocale('nl', {
            months: 'januari_februari_maart_april_mei_juni_juli_augustus_september_oktober_november_december'.split('_'),
            monthsShort: function (m, format) {
                if (/-MMM-/.test(format)) {
                    return monthsShortWithoutDots[m.month()];
                } else {
                    return monthsShortWithDots[m.month()];
                }
            },
            weekdays: 'zondag_maandag_dinsdag_woensdag_donderdag_vrijdag_zaterdag'.split('_'),
            weekdaysShort: 'zo._ma._di._wo._do._vr._za.'.split('_'),
            weekdaysMin: 'Zo_Ma_Di_Wo_Do_Vr_Za'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD-MM-YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[vandaag om] LT',
                nextDay: '[morgen om] LT',
                nextWeek: 'dddd [om] LT',
                lastDay: '[gisteren om] LT',
                lastWeek: '[afgelopen] dddd [om] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'over %s',
                past: '%s geleden',
                s: 'een paar seconden',
                m: 'één minuut',
                mm: '%d minuten',
                h: 'één uur',
                hh: '%d uur',
                d: 'één dag',
                dd: '%d dagen',
                M: 'één maand',
                MM: '%d maanden',
                y: 'één jaar',
                yy: '%d jaar'
            },
            ordinalParse: /\d{1,2}(ste|de)/,
            ordinal: function (number) {
                return number + ((number === 1 || number === 8 || number >= 20) ? 'ste' : 'de');
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : norwegian nynorsk (nn)
    // author : https://github.com/mechuwind

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('nn', {
            months: 'januar_februar_mars_april_mai_juni_juli_august_september_oktober_november_desember'.split('_'),
            monthsShort: 'jan_feb_mar_apr_mai_jun_jul_aug_sep_okt_nov_des'.split('_'),
            weekdays: 'sundag_måndag_tysdag_onsdag_torsdag_fredag_laurdag'.split('_'),
            weekdaysShort: 'sun_mån_tys_ons_tor_fre_lau'.split('_'),
            weekdaysMin: 'su_må_ty_on_to_fr_lø'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[I dag klokka] LT',
                nextDay: '[I morgon klokka] LT',
                nextWeek: 'dddd [klokka] LT',
                lastDay: '[I går klokka] LT',
                lastWeek: '[Føregåande] dddd [klokka] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'om %s',
                past: 'for %s sidan',
                s: 'nokre sekund',
                m: 'eit minutt',
                mm: '%d minutt',
                h: 'ein time',
                hh: '%d timar',
                d: 'ein dag',
                dd: '%d dagar',
                M: 'ein månad',
                MM: '%d månader',
                y: 'eit år',
                yy: '%d år'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : polish (pl)
    // author : Rafal Hirsz : https://github.com/evoL

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var monthsNominative = 'styczeń_luty_marzec_kwiecień_maj_czerwiec_lipiec_sierpień_wrzesień_październik_listopad_grudzień'.split('_'),
            monthsSubjective = 'stycznia_lutego_marca_kwietnia_maja_czerwca_lipca_sierpnia_września_października_listopada_grudnia'.split('_');

        function plural(n) {
            return (n % 10 < 5) && (n % 10 > 1) && ((~~(n / 10) % 10) !== 1);
        }

        function translate(number, withoutSuffix, key) {
            var result = number + ' ';
            switch (key) {
                case 'm':
                    return withoutSuffix ? 'minuta' : 'minutę';
                case 'mm':
                    return result + (plural(number) ? 'minuty' : 'minut');
                case 'h':
                    return withoutSuffix ? 'godzina' : 'godzinę';
                case 'hh':
                    return result + (plural(number) ? 'godziny' : 'godzin');
                case 'MM':
                    return result + (plural(number) ? 'miesiące' : 'miesięcy');
                case 'yy':
                    return result + (plural(number) ? 'lata' : 'lat');
            }
        }

        return moment.defineLocale('pl', {
            months: function (momentToFormat, format) {
                if (/D MMMM/.test(format)) {
                    return monthsSubjective[momentToFormat.month()];
                } else {
                    return monthsNominative[momentToFormat.month()];
                }
            },
            monthsShort: 'sty_lut_mar_kwi_maj_cze_lip_sie_wrz_paź_lis_gru'.split('_'),
            weekdays: 'niedziela_poniedziałek_wtorek_środa_czwartek_piątek_sobota'.split('_'),
            weekdaysShort: 'nie_pon_wt_śr_czw_pt_sb'.split('_'),
            weekdaysMin: 'N_Pn_Wt_Śr_Cz_Pt_So'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Dziś o] LT',
                nextDay: '[Jutro o] LT',
                nextWeek: '[W] dddd [o] LT',
                lastDay: '[Wczoraj o] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[W zeszłą niedzielę o] LT';
                        case 3:
                            return '[W zeszłą środę o] LT';
                        case 6:
                            return '[W zeszłą sobotę o] LT';
                        default:
                            return '[W zeszły] dddd [o] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: '%s temu',
                s: 'kilka sekund',
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: '1 dzień',
                dd: '%d dni',
                M: 'miesiąc',
                MM: translate,
                y: 'rok',
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : brazilian portuguese (pt-br)
    // author : Caio Ribeiro Pereira : https://github.com/caio-ribeiro-pereira

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('pt-br', {
            months: 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split('_'),
            monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
            weekdays: 'domingo_segunda-feira_terça-feira_quarta-feira_quinta-feira_sexta-feira_sábado'.split('_'),
            weekdaysShort: 'dom_seg_ter_qua_qui_sex_sáb'.split('_'),
            weekdaysMin: 'dom_2ª_3ª_4ª_5ª_6ª_sáb'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D [de] MMMM [de] YYYY',
                LLL: 'D [de] MMMM [de] YYYY [� s] LT',
                LLLL: 'dddd, D [de] MMMM [de] YYYY [� s] LT'
            },
            calendar: {
                sameDay: '[Hoje � s] LT',
                nextDay: '[Amanhã � s] LT',
                nextWeek: 'dddd [� s] LT',
                lastDay: '[Ontem � s] LT',
                lastWeek: function () {
                    return (this.day() === 0 || this.day() === 6) ?
                        '[Último] dddd [� s] LT' : // Saturday + Sunday
                        '[Última] dddd [� s] LT'; // Monday - Friday
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'em %s',
                past: '%s atrás',
                s: 'segundos',
                m: 'um minuto',
                mm: '%d minutos',
                h: 'uma hora',
                hh: '%d horas',
                d: 'um dia',
                dd: '%d dias',
                M: 'um mês',
                MM: '%d meses',
                y: 'um ano',
                yy: '%d anos'
            },
            ordinalParse: /\d{1,2}º/,
            ordinal: '%dº'
        });
    }));
    // moment.js locale configuration
    // locale : portuguese (pt)
    // author : Jefferson : https://github.com/jalex79

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('pt', {
            months: 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split('_'),
            monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
            weekdays: 'domingo_segunda-feira_terça-feira_quarta-feira_quinta-feira_sexta-feira_sábado'.split('_'),
            weekdaysShort: 'dom_seg_ter_qua_qui_sex_sáb'.split('_'),
            weekdaysMin: 'dom_2ª_3ª_4ª_5ª_6ª_sáb'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D [de] MMMM [de] YYYY',
                LLL: 'D [de] MMMM [de] YYYY LT',
                LLLL: 'dddd, D [de] MMMM [de] YYYY LT'
            },
            calendar: {
                sameDay: '[Hoje � s] LT',
                nextDay: '[Amanhã � s] LT',
                nextWeek: 'dddd [� s] LT',
                lastDay: '[Ontem � s] LT',
                lastWeek: function () {
                    return (this.day() === 0 || this.day() === 6) ?
                        '[Último] dddd [� s] LT' : // Saturday + Sunday
                        '[Última] dddd [� s] LT'; // Monday - Friday
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'em %s',
                past: 'há %s',
                s: 'segundos',
                m: 'um minuto',
                mm: '%d minutos',
                h: 'uma hora',
                hh: '%d horas',
                d: 'um dia',
                dd: '%d dias',
                M: 'um mês',
                MM: '%d meses',
                y: 'um ano',
                yy: '%d anos'
            },
            ordinalParse: /\d{1,2}º/,
            ordinal: '%dº',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : romanian (ro)
    // author : Vlad Gurdiga : https://github.com/gurdiga
    // author : Valentin Agachi : https://github.com/avaly

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function relativeTimeWithPlural(number, withoutSuffix, key) {
            var format = {
                'mm': 'minute',
                'hh': 'ore',
                'dd': 'zile',
                'MM': 'luni',
                'yy': 'ani'
            },
                separator = ' ';
            if (number % 100 >= 20 || (number >= 100 && number % 100 === 0)) {
                separator = ' de ';
            }

            return number + separator + format[key];
        }

        return moment.defineLocale('ro', {
            months: 'ianuarie_februarie_martie_aprilie_mai_iunie_iulie_august_septembrie_octombrie_noiembrie_decembrie'.split('_'),
            monthsShort: 'ian._febr._mart._apr._mai_iun._iul._aug._sept._oct._nov._dec.'.split('_'),
            weekdays: 'duminică_luni_marți_miercuri_joi_vineri_sâmbătă'.split('_'),
            weekdaysShort: 'Dum_Lun_Mar_Mie_Joi_Vin_Sâm'.split('_'),
            weekdaysMin: 'Du_Lu_Ma_Mi_Jo_Vi_Sâ'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY H:mm',
                LLLL: 'dddd, D MMMM YYYY H:mm'
            },
            calendar: {
                sameDay: '[azi la] LT',
                nextDay: '[mâine la] LT',
                nextWeek: 'dddd [la] LT',
                lastDay: '[ieri la] LT',
                lastWeek: '[fosta] dddd [la] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'peste %s',
                past: '%s în urmă',
                s: 'câteva secunde',
                m: 'un minut',
                mm: relativeTimeWithPlural,
                h: 'o oră',
                hh: relativeTimeWithPlural,
                d: 'o zi',
                dd: relativeTimeWithPlural,
                M: 'o lună',
                MM: relativeTimeWithPlural,
                y: 'un an',
                yy: relativeTimeWithPlural
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : russian (ru)
    // author : Viktorminator : https://github.com/Viktorminator
    // Author : Menelion Elensúle : https://github.com/Oire

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function plural(word, num) {
            var forms = word.split('_');
            return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
        }

        function relativeTimeWithPlural(number, withoutSuffix, key) {
            var format = {
                'mm': withoutSuffix ? 'минута_минуты_минут' : 'минуту_минуты_минут',
                'hh': 'час_часа_часов',
                'dd': 'день_дня_дней',
                'MM': 'месяц_месяца_месяцев',
                'yy': 'год_года_лет'
            };
            if (key === 'm') {
                return withoutSuffix ? 'минута' : 'минуту';
            }
            else {
                return number + ' ' + plural(format[key], +number);
            }
        }

        function monthsCaseReplace(m, format) {
            var months = {
                'nominative': 'январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь'.split('_'),
                'accusative': 'января_февраля_марта_апреля_мая_июня_июля_августа_сентября_октября_ноября_декабря'.split('_')
            },

            nounCase = (/D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return months[nounCase][m.month()];
        }

        function monthsShortCaseReplace(m, format) {
            var monthsShort = {
                'nominative': 'янв_фев_март_апр_май_июнь_июль_авг_сен_окт_ноя_дек'.split('_'),
                'accusative': 'янв_фев_мар_апр_мая_июня_июля_авг_сен_окт_ноя_дек'.split('_')
            },

            nounCase = (/D[oD]?(\[[^\[\]]*\]|\s+)+MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return monthsShort[nounCase][m.month()];
        }

        function weekdaysCaseReplace(m, format) {
            var weekdays = {
                'nominative': 'воскресенье_понедельник_вторник_среда_четверг_пятница_суббота'.split('_'),
                'accusative': 'воскресенье_понедельник_вторник_среду_четверг_пятницу_субботу'.split('_')
            },

            nounCase = (/\[ ?[Вв] ?(?:прошлую|следующую|эту)? ?\] ?dddd/).test(format) ?
                'accusative' :
                'nominative';

            return weekdays[nounCase][m.day()];
        }

        return moment.defineLocale('ru', {
            months: monthsCaseReplace,
            monthsShort: monthsShortCaseReplace,
            weekdays: weekdaysCaseReplace,
            weekdaysShort: 'вс_пн_вт_ср_чт_пт_сб'.split('_'),
            weekdaysMin: 'вс_пн_вт_ср_чт_пт_сб'.split('_'),
            monthsParse: [/^янв/i, /^фев/i, /^мар/i, /^апр/i, /^ма[й|я]/i, /^июн/i, /^июл/i, /^авг/i, /^сен/i, /^окт/i, /^ноя/i, /^дек/i],
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY г.',
                LLL: 'D MMMM YYYY г., LT',
                LLLL: 'dddd, D MMMM YYYY г., LT'
            },
            calendar: {
                sameDay: '[Сегодня в] LT',
                nextDay: '[Завтра в] LT',
                lastDay: '[Вчера в] LT',
                nextWeek: function () {
                    return this.day() === 2 ? '[Во] dddd [в] LT' : '[В] dddd [в] LT';
                },
                lastWeek: function (now) {
                    if (now.week() !== this.week()) {
                        switch (this.day()) {
                            case 0:
                                return '[В прошлое] dddd [в] LT';
                            case 1:
                            case 2:
                            case 4:
                                return '[В прошлый] dddd [в] LT';
                            case 3:
                            case 5:
                            case 6:
                                return '[В прошлую] dddd [в] LT';
                        }
                    } else {
                        if (this.day() === 2) {
                            return '[Во] dddd [в] LT';
                        } else {
                            return '[В] dddd [в] LT';
                        }
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'через %s',
                past: '%s назад',
                s: 'несколько секунд',
                m: relativeTimeWithPlural,
                mm: relativeTimeWithPlural,
                h: 'час',
                hh: relativeTimeWithPlural,
                d: 'день',
                dd: relativeTimeWithPlural,
                M: 'месяц',
                MM: relativeTimeWithPlural,
                y: 'год',
                yy: relativeTimeWithPlural
            },

            meridiemParse: /ночи|утра|дня|вечера/i,
            isPM: function (input) {
                return /^(дня|вечера)$/.test(input);
            },

            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'ночи';
                } else if (hour < 12) {
                    return 'утра';
                } else if (hour < 17) {
                    return 'дня';
                } else {
                    return 'вечера';
                }
            },

            ordinalParse: /\d{1,2}-(й|го|я)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'M':
                    case 'd':
                    case 'DDD':
                        return number + '-й';
                    case 'D':
                        return number + '-го';
                    case 'w':
                    case 'W':
                        return number + '-я';
                    default:
                        return number;
                }
            },

            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : slovak (sk)
    // author : Martin Minka : https://github.com/k2s
    // based on work of petrbela : https://github.com/petrbela

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var months = 'január_február_marec_apríl_máj_jún_júl_august_september_október_november_december'.split('_'),
            monthsShort = 'jan_feb_mar_apr_máj_jún_júl_aug_sep_okt_nov_dec'.split('_');

        function plural(n) {
            return (n > 1) && (n < 5);
        }

        function translate(number, withoutSuffix, key, isFuture) {
            var result = number + ' ';
            switch (key) {
                case 's':  // a few seconds / in a few seconds / a few seconds ago
                    return (withoutSuffix || isFuture) ? 'pár sekúnd' : 'pár sekundami';
                case 'm':  // a minute / in a minute / a minute ago
                    return withoutSuffix ? 'minúta' : (isFuture ? 'minútu' : 'minútou');
                case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'minúty' : 'minút');
                    } else {
                        return result + 'minútami';
                    }
                    break;
                case 'h':  // an hour / in an hour / an hour ago
                    return withoutSuffix ? 'hodina' : (isFuture ? 'hodinu' : 'hodinou');
                case 'hh': // 9 hours / in 9 hours / 9 hours ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'hodiny' : 'hodín');
                    } else {
                        return result + 'hodinami';
                    }
                    break;
                case 'd':  // a day / in a day / a day ago
                    return (withoutSuffix || isFuture) ? 'deň' : 'dňom';
                case 'dd': // 9 days / in 9 days / 9 days ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'dni' : 'dní');
                    } else {
                        return result + 'dňami';
                    }
                    break;
                case 'M':  // a month / in a month / a month ago
                    return (withoutSuffix || isFuture) ? 'mesiac' : 'mesiacom';
                case 'MM': // 9 months / in 9 months / 9 months ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'mesiace' : 'mesiacov');
                    } else {
                        return result + 'mesiacmi';
                    }
                    break;
                case 'y':  // a year / in a year / a year ago
                    return (withoutSuffix || isFuture) ? 'rok' : 'rokom';
                case 'yy': // 9 years / in 9 years / 9 years ago
                    if (withoutSuffix || isFuture) {
                        return result + (plural(number) ? 'roky' : 'rokov');
                    } else {
                        return result + 'rokmi';
                    }
                    break;
            }
        }

        return moment.defineLocale('sk', {
            months: months,
            monthsShort: monthsShort,
            monthsParse: (function (months, monthsShort) {
                var i, _monthsParse = [];
                for (i = 0; i < 12; i++) {
                    // use custom parser to solve problem with July (červenec)
                    _monthsParse[i] = new RegExp('^' + months[i] + '$|^' + monthsShort[i] + '$', 'i');
                }
                return _monthsParse;
            }(months, monthsShort)),
            weekdays: 'nedeľa_pondelok_utorok_streda_štvrtok_piatok_sobota'.split('_'),
            weekdaysShort: 'ne_po_ut_st_št_pi_so'.split('_'),
            weekdaysMin: 'ne_po_ut_st_št_pi_so'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[dnes o] LT',
                nextDay: '[zajtra o] LT',
                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[v nedeľu o] LT';
                        case 1:
                        case 2:
                            return '[v] dddd [o] LT';
                        case 3:
                            return '[v stredu o] LT';
                        case 4:
                            return '[vo štvrtok o] LT';
                        case 5:
                            return '[v piatok o] LT';
                        case 6:
                            return '[v sobotu o] LT';
                    }
                },
                lastDay: '[včera o] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[minulú nedeľu o] LT';
                        case 1:
                        case 2:
                            return '[minulý] dddd [o] LT';
                        case 3:
                            return '[minulú stredu o] LT';
                        case 4:
                        case 5:
                            return '[minulý] dddd [o] LT';
                        case 6:
                            return '[minulú sobotu o] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: 'pred %s',
                s: translate,
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: translate,
                dd: translate,
                M: translate,
                MM: translate,
                y: translate,
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : slovenian (sl)
    // author : Robert Sedovšek : https://github.com/sedovsek

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function translate(number, withoutSuffix, key) {
            var result = number + ' ';
            switch (key) {
                case 'm':
                    return withoutSuffix ? 'ena minuta' : 'eno minuto';
                case 'mm':
                    if (number === 1) {
                        result += 'minuta';
                    } else if (number === 2) {
                        result += 'minuti';
                    } else if (number === 3 || number === 4) {
                        result += 'minute';
                    } else {
                        result += 'minut';
                    }
                    return result;
                case 'h':
                    return withoutSuffix ? 'ena ura' : 'eno uro';
                case 'hh':
                    if (number === 1) {
                        result += 'ura';
                    } else if (number === 2) {
                        result += 'uri';
                    } else if (number === 3 || number === 4) {
                        result += 'ure';
                    } else {
                        result += 'ur';
                    }
                    return result;
                case 'dd':
                    if (number === 1) {
                        result += 'dan';
                    } else {
                        result += 'dni';
                    }
                    return result;
                case 'MM':
                    if (number === 1) {
                        result += 'mesec';
                    } else if (number === 2) {
                        result += 'meseca';
                    } else if (number === 3 || number === 4) {
                        result += 'mesece';
                    } else {
                        result += 'mesecev';
                    }
                    return result;
                case 'yy':
                    if (number === 1) {
                        result += 'leto';
                    } else if (number === 2) {
                        result += 'leti';
                    } else if (number === 3 || number === 4) {
                        result += 'leta';
                    } else {
                        result += 'let';
                    }
                    return result;
            }
        }

        return moment.defineLocale('sl', {
            months: 'januar_februar_marec_april_maj_junij_julij_avgust_september_oktober_november_december'.split('_'),
            monthsShort: 'jan._feb._mar._apr._maj._jun._jul._avg._sep._okt._nov._dec.'.split('_'),
            weekdays: 'nedelja_ponedeljek_torek_sreda_četrtek_petek_sobota'.split('_'),
            weekdaysShort: 'ned._pon._tor._sre._čet._pet._sob.'.split('_'),
            weekdaysMin: 'ne_po_to_sr_če_pe_so'.split('_'),
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD. MM. YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[danes ob] LT',
                nextDay: '[jutri ob] LT',

                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[v] [nedeljo] [ob] LT';
                        case 3:
                            return '[v] [sredo] [ob] LT';
                        case 6:
                            return '[v] [soboto] [ob] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[v] dddd [ob] LT';
                    }
                },
                lastDay: '[včeraj ob] LT',
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                        case 6:
                            return '[prejšnja] dddd [ob] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[prejšnji] dddd [ob] LT';
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'čez %s',
                past: '%s nazaj',
                s: 'nekaj sekund',
                m: translate,
                mm: translate,
                h: translate,
                hh: translate,
                d: 'en dan',
                dd: translate,
                M: 'en mesec',
                MM: translate,
                y: 'eno leto',
                yy: translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Albanian (sq)
    // author : Flakërim Ismani : https://github.com/flakerimi
    // author: Menelion Elensúle: https://github.com/Oire (tests)
    // author : Oerd Cukalla : https://github.com/oerd (fixes)

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('sq', {
            months: 'Janar_Shkurt_Mars_Prill_Maj_Qershor_Korrik_Gusht_Shtator_Tetor_Nëntor_Dhjetor'.split('_'),
            monthsShort: 'Jan_Shk_Mar_Pri_Maj_Qer_Kor_Gus_Sht_Tet_Nën_Dhj'.split('_'),
            weekdays: 'E Diel_E Hënë_E Martë_E Mërkurë_E Enjte_E Premte_E Shtunë'.split('_'),
            weekdaysShort: 'Die_Hën_Mar_Mër_Enj_Pre_Sht'.split('_'),
            weekdaysMin: 'D_H_Ma_Më_E_P_Sh'.split('_'),
            meridiemParse: /PD|MD/,
            isPM: function (input) {
                return input.charAt(0) === 'M';
            },
            meridiem: function (hours, minutes, isLower) {
                return hours < 12 ? 'PD' : 'MD';
            },
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Sot në] LT',
                nextDay: '[Nesër në] LT',
                nextWeek: 'dddd [në] LT',
                lastDay: '[Dje në] LT',
                lastWeek: 'dddd [e kaluar në] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'në %s',
                past: '%s më parë',
                s: 'disa sekonda',
                m: 'një minutë',
                mm: '%d minuta',
                h: 'një orë',
                hh: '%d orë',
                d: 'një ditë',
                dd: '%d ditë',
                M: 'një muaj',
                MM: '%d muaj',
                y: 'një vit',
                yy: '%d vite'
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Serbian-cyrillic (sr-cyrl)
    // author : Milan Janačković<milanjanackovic@gmail.com> : https://github.com/milan-j

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var translator = {
            words: { //Different grammatical cases
                m: ['један минут', 'једне минуте'],
                mm: ['минут', 'минуте', 'минута'],
                h: ['један сат', 'једног сата'],
                hh: ['сат', 'сата', 'сати'],
                dd: ['дан', 'дана', 'дана'],
                MM: ['месец', 'месеца', 'месеци'],
                yy: ['година', 'године', 'година']
            },
            correctGrammaticalCase: function (number, wordKey) {
                return number === 1 ? wordKey[0] : (number >= 2 && number <= 4 ? wordKey[1] : wordKey[2]);
            },
            translate: function (number, withoutSuffix, key) {
                var wordKey = translator.words[key];
                if (key.length === 1) {
                    return withoutSuffix ? wordKey[0] : wordKey[1];
                } else {
                    return number + ' ' + translator.correctGrammaticalCase(number, wordKey);
                }
            }
        };

        return moment.defineLocale('sr-cyrl', {
            months: ['јануар', 'фебруар', 'март', 'април', 'мај', 'јун', 'јул', 'август', 'септембар', 'октобар', 'новембар', 'децембар'],
            monthsShort: ['јан.', 'феб.', 'мар.', 'апр.', 'мај', 'јун', 'јул', 'авг.', 'сеп.', 'окт.', 'нов.', 'дец.'],
            weekdays: ['недеља', 'понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота'],
            weekdaysShort: ['нед.', 'пон.', 'уто.', 'сре.', 'чет.', 'пет.', 'суб.'],
            weekdaysMin: ['не', 'по', 'ут', 'ср', 'че', 'пе', 'су'],
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD. MM. YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[данас у] LT',
                nextDay: '[сутра у] LT',

                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[у] [недељу] [у] LT';
                        case 3:
                            return '[у] [среду] [у] LT';
                        case 6:
                            return '[у] [суботу] [у] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[у] dddd [у] LT';
                    }
                },
                lastDay: '[јуче у] LT',
                lastWeek: function () {
                    var lastWeekDays = [
                        '[прошле] [недеље] [у] LT',
                        '[прошлог] [понедељка] [у] LT',
                        '[прошлог] [уторка] [у] LT',
                        '[прошле] [среде] [у] LT',
                        '[прошлог] [четвртка] [у] LT',
                        '[прошлог] [петка] [у] LT',
                        '[прошле] [суботе] [у] LT'
                    ];
                    return lastWeekDays[this.day()];
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'за %s',
                past: 'пре %s',
                s: 'неколико секунди',
                m: translator.translate,
                mm: translator.translate,
                h: translator.translate,
                hh: translator.translate,
                d: 'дан',
                dd: translator.translate,
                M: 'месец',
                MM: translator.translate,
                y: 'годину',
                yy: translator.translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Serbian-latin (sr)
    // author : Milan Janačković<milanjanackovic@gmail.com> : https://github.com/milan-j

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var translator = {
            words: { //Different grammatical cases
                m: ['jedan minut', 'jedne minute'],
                mm: ['minut', 'minute', 'minuta'],
                h: ['jedan sat', 'jednog sata'],
                hh: ['sat', 'sata', 'sati'],
                dd: ['dan', 'dana', 'dana'],
                MM: ['mesec', 'meseca', 'meseci'],
                yy: ['godina', 'godine', 'godina']
            },
            correctGrammaticalCase: function (number, wordKey) {
                return number === 1 ? wordKey[0] : (number >= 2 && number <= 4 ? wordKey[1] : wordKey[2]);
            },
            translate: function (number, withoutSuffix, key) {
                var wordKey = translator.words[key];
                if (key.length === 1) {
                    return withoutSuffix ? wordKey[0] : wordKey[1];
                } else {
                    return number + ' ' + translator.correctGrammaticalCase(number, wordKey);
                }
            }
        };

        return moment.defineLocale('sr', {
            months: ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'],
            monthsShort: ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun', 'jul', 'avg.', 'sep.', 'okt.', 'nov.', 'dec.'],
            weekdays: ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'],
            weekdaysShort: ['ned.', 'pon.', 'uto.', 'sre.', 'čet.', 'pet.', 'sub.'],
            weekdaysMin: ['ne', 'po', 'ut', 'sr', 'če', 'pe', 'su'],
            longDateFormat: {
                LT: 'H:mm',
                LTS: 'LT:ss',
                L: 'DD. MM. YYYY',
                LL: 'D. MMMM YYYY',
                LLL: 'D. MMMM YYYY LT',
                LLLL: 'dddd, D. MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[danas u] LT',
                nextDay: '[sutra u] LT',

                nextWeek: function () {
                    switch (this.day()) {
                        case 0:
                            return '[u] [nedelju] [u] LT';
                        case 3:
                            return '[u] [sredu] [u] LT';
                        case 6:
                            return '[u] [subotu] [u] LT';
                        case 1:
                        case 2:
                        case 4:
                        case 5:
                            return '[u] dddd [u] LT';
                    }
                },
                lastDay: '[juče u] LT',
                lastWeek: function () {
                    var lastWeekDays = [
                        '[prošle] [nedelje] [u] LT',
                        '[prošlog] [ponedeljka] [u] LT',
                        '[prošlog] [utorka] [u] LT',
                        '[prošle] [srede] [u] LT',
                        '[prošlog] [četvrtka] [u] LT',
                        '[prošlog] [petka] [u] LT',
                        '[prošle] [subote] [u] LT'
                    ];
                    return lastWeekDays[this.day()];
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'za %s',
                past: 'pre %s',
                s: 'nekoliko sekundi',
                m: translator.translate,
                mm: translator.translate,
                h: translator.translate,
                hh: translator.translate,
                d: 'dan',
                dd: translator.translate,
                M: 'mesec',
                MM: translator.translate,
                y: 'godinu',
                yy: translator.translate
            },
            ordinalParse: /\d{1,2}\./,
            ordinal: '%d.',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : swedish (sv)
    // author : Jens Alm : https://github.com/ulmus

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('sv', {
            months: 'januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december'.split('_'),
            monthsShort: 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
            weekdays: 'söndag_måndag_tisdag_onsdag_torsdag_fredag_lördag'.split('_'),
            weekdaysShort: 'sön_mån_tis_ons_tor_fre_lör'.split('_'),
            weekdaysMin: 'sö_må_ti_on_to_fr_lö'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'YYYY-MM-DD',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[Idag] LT',
                nextDay: '[Imorgon] LT',
                lastDay: '[Igår] LT',
                nextWeek: 'dddd LT',
                lastWeek: '[Förra] dddd[en] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'om %s',
                past: 'för %s sedan',
                s: 'några sekunder',
                m: 'en minut',
                mm: '%d minuter',
                h: 'en timme',
                hh: '%d timmar',
                d: 'en dag',
                dd: '%d dagar',
                M: 'en månad',
                MM: '%d månader',
                y: 'ett år',
                yy: '%d år'
            },
            ordinalParse: /\d{1,2}(e|a)/,
            ordinal: function (number) {
                var b = number % 10,
                    output = (~~(number % 100 / 10) === 1) ? 'e' :
                    (b === 1) ? 'a' :
                    (b === 2) ? 'a' :
                    (b === 3) ? 'e' : 'e';
                return number + output;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : tamil (ta)
    // author : Arjunkumar Krishnamoorthy : https://github.com/tk120404

    (function (factory) {
        factory(moment);
    }(function (moment) {
        /*var symbolMap = {
                '1': '௧',
                '2': '௨',
                '3': '௩',
                '4': '௪',
                '5': '௫',
                '6': '௬',
                '7': '௭',
                '8': '௮',
                '9': '௯',
                '0': '௦'
            },
            numberMap = {
                '௧': '1',
                '௨': '2',
                '௩': '3',
                '௪': '4',
                '௫': '5',
                '௬': '6',
                '௭': '7',
                '௮': '8',
                '௯': '9',
                '௦': '0'
            }; */

        return moment.defineLocale('ta', {
            months: 'ஜனவரி_பிப்ரவரி_மார்ச்_ஏப்ரல்_மே_ஜூன்_ஜூலை_ஆகஸ்ட்_செப்டெம்பர்_அக்டோபர்_நவம்பர்_டிசம்பர்'.split('_'),
            monthsShort: 'ஜனவரி_பிப்ரவரி_மார்ச்_ஏப்ரல்_மே_ஜூன்_ஜூலை_ஆகஸ்ட்_செப்டெம்பர்_அக்டோபர்_நவம்பர்_டிசம்பர்'.split('_'),
            weekdays: 'ஞாயிற்றுக்கிழமை_திங்கட்கிழமை_செவ்வாய்கிழமை_புதன்கிழமை_வியாழக்கிழமை_வெள்ளிக்கிழமை_சனிக்கிழமை'.split('_'),
            weekdaysShort: 'ஞாயிறு_திங்கள்_செவ்வாய்_புதன்_வியாழன்_வெள்ளி_சனி'.split('_'),
            weekdaysMin: 'ஞா_தி_செ_பு_வி_வெ_ச'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY, LT',
                LLLL: 'dddd, D MMMM YYYY, LT'
            },
            calendar: {
                sameDay: '[இன்று] LT',
                nextDay: '[நாளை] LT',
                nextWeek: 'dddd, LT',
                lastDay: '[நேற்று] LT',
                lastWeek: '[கடந்த வாரம்] dddd, LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s இல்',
                past: '%s முன்',
                s: 'ஒரு சில விநாடிகள்',
                m: 'ஒரு நிமிடம்',
                mm: '%d நிமிடங்கள்',
                h: 'ஒரு மணி நேரம்',
                hh: '%d மணி நேரம்',
                d: 'ஒரு நாள்',
                dd: '%d நாட்கள்',
                M: 'ஒரு மாதம்',
                MM: '%d மாதங்கள்',
                y: 'ஒரு வருடம்',
                yy: '%d ஆண்டுகள்'
            },
            /*        preparse: function (string) {
                        return string.replace(/[௧௨௩௪௫௬௭௮௯௦]/g, function (match) {
                            return numberMap[match];
                        });
                    },
                    postformat: function (string) {
                        return string.replace(/\d/g, function (match) {
                            return symbolMap[match];
                        });
                    },*/
            ordinalParse: /\d{1,2}வது/,
            ordinal: function (number) {
                return number + 'வது';
            },


            // refer http://ta.wikipedia.org/s/1er1
            meridiemParse: /யாமம்|வைகறை|காலை|நண்பகல்|எற்பாடு|மாலை/,
            meridiem: function (hour, minute, isLower) {
                if (hour < 2) {
                    return ' யாமம்';
                } else if (hour < 6) {
                    return ' வைகறை';  // வைகறை
                } else if (hour < 10) {
                    return ' காலை'; // காலை
                } else if (hour < 14) {
                    return ' நண்பகல்'; // நண்பகல்
                } else if (hour < 18) {
                    return ' எற்பாடு'; // எற்பாடு
                } else if (hour < 22) {
                    return ' மாலை'; // மாலை
                } else {
                    return ' யாமம்';
                }
            },
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === 'யாமம்') {
                    return hour < 2 ? hour : hour + 12;
                } else if (meridiem === 'வைகறை' || meridiem === 'காலை') {
                    return hour;
                } else if (meridiem === 'நண்பகல்') {
                    return hour >= 10 ? hour : hour + 12;
                } else {
                    return hour + 12;
                }
            },
            week: {
                dow: 0, // Sunday is the first day of the week.
                doy: 6  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : thai (th)
    // author : Kridsada Thanabulpong : https://github.com/sirn

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('th', {
            months: 'มกราคม_กุม� าพันธ์_มีนาคม_เมษายน_พฤษ� าคม_มิถุนายน_กรกฎาคม_สิงหาคม_กันยายน_ตุลาคม_พฤศจิกายน_ธันวาคม'.split('_'),
            monthsShort: 'มกรา_กุม� า_มีนา_เมษา_พฤษ� า_มิถุนา_กรกฎา_สิงหา_กันยา_ตุลา_พฤศจิกา_ธันวา'.split('_'),
            weekdays: 'อาทิตย์_จันทร์_อังคาร_พุธ_พฤหัสบดี_ศุกร์_เสาร์'.split('_'),
            weekdaysShort: 'อาทิตย์_จันทร์_อังคาร_พุธ_พฤหัส_ศุกร์_เสาร์'.split('_'), // yes, three characters difference
            weekdaysMin: 'อา._จ._อ._พ._พฤ._ศ._ส.'.split('_'),
            longDateFormat: {
                LT: 'H นาฬิกา m นาที',
                LTS: 'LT s วินาที',
                L: 'YYYY/MM/DD',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY เวลา LT',
                LLLL: 'วันddddที่ D MMMM YYYY เวลา LT'
            },
            meridiemParse: /ก่อนเที่ยง|หลังเที่ยง/,
            isPM: function (input) {
                return input === 'หลังเที่ยง';
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 12) {
                    return 'ก่อนเที่ยง';
                } else {
                    return 'หลังเที่ยง';
                }
            },
            calendar: {
                sameDay: '[วันนี้ เวลา] LT',
                nextDay: '[พรุ่งนี้ เวลา] LT',
                nextWeek: 'dddd[หน้า เวลา] LT',
                lastDay: '[เมื่อวานนี้ เวลา] LT',
                lastWeek: '[วัน]dddd[ที่แล้ว เวลา] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'อีก %s',
                past: '%sที่แล้ว',
                s: 'ไม่กี่วินาที',
                m: '1 นาที',
                mm: '%d นาที',
                h: '1 ชั่วโมง',
                hh: '%d ชั่วโมง',
                d: '1 วัน',
                dd: '%d วัน',
                M: '1 เดือน',
                MM: '%d เดือน',
                y: '1 ปี',
                yy: '%d ปี'
            }
        });
    }));
    // moment.js locale configuration
    // locale : Tagalog/Filipino (tl-ph)
    // author : Dan Hagman

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('tl-ph', {
            months: 'Enero_Pebrero_Marso_Abril_Mayo_Hunyo_Hulyo_Agosto_Setyembre_Oktubre_Nobyembre_Disyembre'.split('_'),
            monthsShort: 'Ene_Peb_Mar_Abr_May_Hun_Hul_Ago_Set_Okt_Nob_Dis'.split('_'),
            weekdays: 'Linggo_Lunes_Martes_Miyerkules_Huwebes_Biyernes_Sabado'.split('_'),
            weekdaysShort: 'Lin_Lun_Mar_Miy_Huw_Biy_Sab'.split('_'),
            weekdaysMin: 'Li_Lu_Ma_Mi_Hu_Bi_Sab'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'MM/D/YYYY',
                LL: 'MMMM D, YYYY',
                LLL: 'MMMM D, YYYY LT',
                LLLL: 'dddd, MMMM DD, YYYY LT'
            },
            calendar: {
                sameDay: '[Ngayon sa] LT',
                nextDay: '[Bukas sa] LT',
                nextWeek: 'dddd [sa] LT',
                lastDay: '[Kahapon sa] LT',
                lastWeek: 'dddd [huling linggo] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'sa loob ng %s',
                past: '%s ang nakalipas',
                s: 'ilang segundo',
                m: 'isang minuto',
                mm: '%d minuto',
                h: 'isang oras',
                hh: '%d oras',
                d: 'isang araw',
                dd: '%d araw',
                M: 'isang buwan',
                MM: '%d buwan',
                y: 'isang taon',
                yy: '%d taon'
            },
            ordinalParse: /\d{1,2}/,
            ordinal: function (number) {
                return number;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : turkish (tr)
    // authors : Erhan Gundogan : https://github.com/erhangundogan,
    //           Burak Yiğit Kaya: https://github.com/BYK

    (function (factory) {
        factory(moment);
    }(function (moment) {
        var suffixes = {
            1: '\'inci',
            5: '\'inci',
            8: '\'inci',
            70: '\'inci',
            80: '\'inci',

            2: '\'nci',
            7: '\'nci',
            20: '\'nci',
            50: '\'nci',

            3: '\'üncü',
            4: '\'üncü',
            100: '\'üncü',

            6: '\'ncı',

            9: '\'uncu',
            10: '\'uncu',
            30: '\'uncu',

            60: '\'ıncı',
            90: '\'ıncı'
        };

        return moment.defineLocale('tr', {
            months: 'Ocak_Şubat_Mart_Nisan_Mayıs_Haziran_Temmuz_Ağustos_Eylül_Ekim_Kasım_Aralık'.split('_'),
            monthsShort: 'Oca_Şub_Mar_Nis_May_Haz_Tem_Ağu_Eyl_Eki_Kas_Ara'.split('_'),
            weekdays: 'Pazar_Pazartesi_Salı_Çarşamba_Perşembe_Cuma_Cumartesi'.split('_'),
            weekdaysShort: 'Paz_Pts_Sal_Çar_Per_Cum_Cts'.split('_'),
            weekdaysMin: 'Pz_Pt_Sa_Ça_Pe_Cu_Ct'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd, D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[bugün saat] LT',
                nextDay: '[yarın saat] LT',
                nextWeek: '[haftaya] dddd [saat] LT',
                lastDay: '[dün] LT',
                lastWeek: '[geçen hafta] dddd [saat] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s sonra',
                past: '%s önce',
                s: 'birkaç saniye',
                m: 'bir dakika',
                mm: '%d dakika',
                h: 'bir saat',
                hh: '%d saat',
                d: 'bir gün',
                dd: '%d gün',
                M: 'bir ay',
                MM: '%d ay',
                y: 'bir yıl',
                yy: '%d yıl'
            },
            ordinalParse: /\d{1,2}'(inci|nci|üncü|ncı|uncu|ıncı)/,
            ordinal: function (number) {
                if (number === 0) {  // special case for zero
                    return number + '\'ıncı';
                }
                var a = number % 10,
                    b = number % 100 - a,
                    c = number >= 100 ? 100 : null;

                return number + (suffixes[a] || suffixes[b] || suffixes[c]);
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Morocco Central Atlas Tamaziɣt in Latin (tzm-latn)
    // author : Abdel Said : https://github.com/abdelsaid

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('tzm-latn', {
            months: 'innayr_brˤayrˤ_marˤsˤ_ibrir_mayyw_ywnyw_ywlywz_ɣwšt_šwtanbir_ktˤwbrˤ_nwwanbir_dwjnbir'.split('_'),
            monthsShort: 'innayr_brˤayrˤ_marˤsˤ_ibrir_mayyw_ywnyw_ywlywz_ɣwšt_šwtanbir_ktˤwbrˤ_nwwanbir_dwjnbir'.split('_'),
            weekdays: 'asamas_aynas_asinas_akras_akwas_asimwas_asiḍyas'.split('_'),
            weekdaysShort: 'asamas_aynas_asinas_akras_akwas_asimwas_asiḍyas'.split('_'),
            weekdaysMin: 'asamas_aynas_asinas_akras_akwas_asimwas_asiḍyas'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[asdkh g] LT',
                nextDay: '[aska g] LT',
                nextWeek: 'dddd [g] LT',
                lastDay: '[assant g] LT',
                lastWeek: 'dddd [g] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'dadkh s yan %s',
                past: 'yan %s',
                s: 'imik',
                m: 'minuḍ',
                mm: '%d minuḍ',
                h: 'saɛa',
                hh: '%d tassaɛin',
                d: 'ass',
                dd: '%d ossan',
                M: 'ayowr',
                MM: '%d iyyirn',
                y: 'asgas',
                yy: '%d isgasn'
            },
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : Morocco Central Atlas Tamaziɣt (tzm)
    // author : Abdel Said : https://github.com/abdelsaid

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('tzm', {
            months: 'ⵉⵏⵏⴰⵢⵔ_ⴱⵕⴰⵢⵕ_ⵎⴰⵕⵚ_ⵉⴱⵔⵉⵔ_ⵎⴰⵢⵢⵓ_ⵢⵓⵏⵢⵓ_ⵢⵓⵍⵢⵓⵣ_ⵖⵓⵛⵜ_ⵛⵓⵜⴰⵏⴱⵉⵔ_ⴽⵟⵓⴱⵕ_ⵏⵓⵡⴰⵏⴱⵉⵔ_ⴷⵓⵊⵏⴱⵉⵔ'.split('_'),
            monthsShort: 'ⵉⵏⵏⴰⵢⵔ_ⴱⵕⴰⵢⵕ_ⵎⴰⵕⵚ_ⵉⴱⵔⵉⵔ_ⵎⴰⵢⵢⵓ_ⵢⵓⵏⵢⵓ_ⵢⵓⵍⵢⵓⵣ_ⵖⵓⵛⵜ_ⵛⵓⵜⴰⵏⴱⵉⵔ_ⴽⵟⵓⴱⵕ_ⵏⵓⵡⴰⵏⴱⵉⵔ_ⴷⵓⵊⵏⴱⵉⵔ'.split('_'),
            weekdays: 'ⴰⵙⴰⵎⴰⵙ_ⴰⵢⵏⴰⵙ_ⴰⵙⵉⵏⴰⵙ_ⴰⴽⵔⴰⵙ_ⴰⴽⵡⴰⵙ_ⴰⵙⵉⵎⵡⴰⵙ_ⴰⵙⵉⴹⵢⴰⵙ'.split('_'),
            weekdaysShort: 'ⴰⵙⴰⵎⴰⵙ_ⴰⵢⵏⴰⵙ_ⴰⵙⵉⵏⴰⵙ_ⴰⴽⵔⴰⵙ_ⴰⴽⵡⴰⵙ_ⴰⵙⵉⵎⵡⴰⵙ_ⴰⵙⵉⴹⵢⴰⵙ'.split('_'),
            weekdaysMin: 'ⴰⵙⴰⵎⴰⵙ_ⴰⵢⵏⴰⵙ_ⴰⵙⵉⵏⴰⵙ_ⴰⴽⵔⴰⵙ_ⴰⴽⵡⴰⵙ_ⴰⵙⵉⵎⵡⴰⵙ_ⴰⵙⵉⴹⵢⴰⵙ'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'dddd D MMMM YYYY LT'
            },
            calendar: {
                sameDay: '[ⴰⵙⴷⵅ ⴴ] LT',
                nextDay: '[ⴰⵙⴽⴰ ⴴ] LT',
                nextWeek: 'dddd [ⴴ] LT',
                lastDay: '[ⴰⵚⴰⵏⵜ ⴴ] LT',
                lastWeek: 'dddd [ⴴ] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'ⴷⴰⴷⵅ ⵙ ⵢⴰⵏ %s',
                past: 'ⵢⴰⵏ %s',
                s: 'ⵉⵎⵉⴽ',
                m: 'ⵎⵉⵏⵓⴺ',
                mm: '%d ⵎⵉⵏⵓⴺ',
                h: 'ⵙⴰⵄⴰ',
                hh: '%d ⵜⴰⵙⵙⴰⵄⵉⵏ',
                d: 'ⴰⵙⵙ',
                dd: '%d oⵙⵙⴰⵏ',
                M: 'ⴰⵢoⵓⵔ',
                MM: '%d ⵉⵢⵢⵉⵔⵏ',
                y: 'ⴰⵙⴳⴰⵙ',
                yy: '%d ⵉⵙⴳⴰⵙⵏ'
            },
            week: {
                dow: 6, // Saturday is the first day of the week.
                doy: 12  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : ukrainian (uk)
    // author : zemlanin : https://github.com/zemlanin
    // Author : Menelion Elensúle : https://github.com/Oire

    (function (factory) {
        factory(moment);
    }(function (moment) {
        function plural(word, num) {
            var forms = word.split('_');
            return num % 10 === 1 && num % 100 !== 11 ? forms[0] : (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20) ? forms[1] : forms[2]);
        }

        function relativeTimeWithPlural(number, withoutSuffix, key) {
            var format = {
                'mm': 'хвилина_хвилини_хвилин',
                'hh': 'година_години_годин',
                'dd': 'день_дні_днів',
                'MM': 'місяць_місяці_місяців',
                'yy': 'рік_роки_років'
            };
            if (key === 'm') {
                return withoutSuffix ? 'хвилина' : 'хвилину';
            }
            else if (key === 'h') {
                return withoutSuffix ? 'година' : 'годину';
            }
            else {
                return number + ' ' + plural(format[key], +number);
            }
        }

        function monthsCaseReplace(m, format) {
            var months = {
                'nominative': 'січень_лютий_березень_квітень_травень_червень_липень_серпень_вересень_жовтень_листопад_грудень'.split('_'),
                'accusative': 'січня_лютого_березня_квітня_травня_червня_липня_серпня_вересня_жовтня_листопада_грудня'.split('_')
            },

            nounCase = (/D[oD]? *MMMM?/).test(format) ?
                'accusative' :
                'nominative';

            return months[nounCase][m.month()];
        }

        function weekdaysCaseReplace(m, format) {
            var weekdays = {
                'nominative': 'неділя_понеділок_вівторок_середа_четвер_п’ятниця_субота'.split('_'),
                'accusative': 'неділю_понеділок_вівторок_середу_четвер_п’ятницю_суботу'.split('_'),
                'genitive': 'неділі_понеділка_вівторка_середи_четверга_п’ятниці_суботи'.split('_')
            },

            nounCase = (/(\[[ВвУу]\]) ?dddd/).test(format) ?
                'accusative' :
                ((/\[?(?:минулої|наступної)? ?\] ?dddd/).test(format) ?
                    'genitive' :
                    'nominative');

            return weekdays[nounCase][m.day()];
        }

        function processHoursFunction(str) {
            return function () {
                return str + 'о' + (this.hours() === 11 ? 'б' : '') + '] LT';
            };
        }

        return moment.defineLocale('uk', {
            months: monthsCaseReplace,
            monthsShort: 'січ_лют_бер_квіт_трав_черв_лип_серп_вер_жовт_лист_груд'.split('_'),
            weekdays: weekdaysCaseReplace,
            weekdaysShort: 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
            weekdaysMin: 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD.MM.YYYY',
                LL: 'D MMMM YYYY р.',
                LLL: 'D MMMM YYYY р., LT',
                LLLL: 'dddd, D MMMM YYYY р., LT'
            },
            calendar: {
                sameDay: processHoursFunction('[Сьогодні '),
                nextDay: processHoursFunction('[Завтра '),
                lastDay: processHoursFunction('[Вчора '),
                nextWeek: processHoursFunction('[У] dddd ['),
                lastWeek: function () {
                    switch (this.day()) {
                        case 0:
                        case 3:
                        case 5:
                        case 6:
                            return processHoursFunction('[Минулої] dddd [').call(this);
                        case 1:
                        case 2:
                        case 4:
                            return processHoursFunction('[Минулого] dddd [').call(this);
                    }
                },
                sameElse: 'L'
            },
            relativeTime: {
                future: 'за %s',
                past: '%s тому',
                s: 'декілька секунд',
                m: relativeTimeWithPlural,
                mm: relativeTimeWithPlural,
                h: 'годину',
                hh: relativeTimeWithPlural,
                d: 'день',
                dd: relativeTimeWithPlural,
                M: 'місяць',
                MM: relativeTimeWithPlural,
                y: 'рік',
                yy: relativeTimeWithPlural
            },

            // M. E.: those two are virtually unused but a user might want to implement them for his/her website for some reason

            meridiemParse: /ночі|ранку|дня|вечора/,
            isPM: function (input) {
                return /^(дня|вечора)$/.test(input);
            },
            meridiem: function (hour, minute, isLower) {
                if (hour < 4) {
                    return 'ночі';
                } else if (hour < 12) {
                    return 'ранку';
                } else if (hour < 17) {
                    return 'дня';
                } else {
                    return 'вечора';
                }
            },

            ordinalParse: /\d{1,2}-(й|го)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'M':
                    case 'd':
                    case 'DDD':
                    case 'w':
                    case 'W':
                        return number + '-й';
                    case 'D':
                        return number + '-го';
                    default:
                        return number;
                }
            },

            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 1st is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : uzbek (uz)
    // author : Sardor Muminov : https://github.com/muminoff

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('uz', {
            months: 'январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь'.split('_'),
            monthsShort: 'янв_фев_мар_апр_май_июн_июл_авг_сен_окт_ноя_дек'.split('_'),
            weekdays: 'Якшанба_Душанба_Сешанба_Чоршанба_Пайшанба_Жума_Шанба'.split('_'),
            weekdaysShort: 'Якш_Душ_Сеш_Чор_Пай_Жум_Шан'.split('_'),
            weekdaysMin: 'Як_Ду_Се_Чо_Па_Жу_Ша'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM YYYY',
                LLL: 'D MMMM YYYY LT',
                LLLL: 'D MMMM YYYY, dddd LT'
            },
            calendar: {
                sameDay: '[Бугун соат] LT [да]',
                nextDay: '[Эртага] LT [да]',
                nextWeek: 'dddd [куни соат] LT [да]',
                lastDay: '[Кеча соат] LT [да]',
                lastWeek: '[Утган] dddd [куни соат] LT [да]',
                sameElse: 'L'
            },
            relativeTime: {
                future: 'Якин %s ичида',
                past: 'Бир неча %s олдин',
                s: 'фурсат',
                m: 'бир дакика',
                mm: '%d дакика',
                h: 'бир соат',
                hh: '%d соат',
                d: 'бир кун',
                dd: '%d кун',
                M: 'бир ой',
                MM: '%d ой',
                y: 'бир йил',
                yy: '%d йил'
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 7  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : vietnamese (vi)
    // author : Bang Nguyen : https://github.com/bangnk

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('vi', {
            months: 'tháng 1_tháng 2_tháng 3_tháng 4_tháng 5_tháng 6_tháng 7_tháng 8_tháng 9_tháng 10_tháng 11_tháng 12'.split('_'),
            monthsShort: 'Th01_Th02_Th03_Th04_Th05_Th06_Th07_Th08_Th09_Th10_Th11_Th12'.split('_'),
            weekdays: 'chủ nhật_thứ hai_thứ ba_thứ tư_thứ năm_thứ sáu_thứ bảy'.split('_'),
            weekdaysShort: 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
            weekdaysMin: 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'LT:ss',
                L: 'DD/MM/YYYY',
                LL: 'D MMMM [năm] YYYY',
                LLL: 'D MMMM [năm] YYYY LT',
                LLLL: 'dddd, D MMMM [năm] YYYY LT',
                l: 'DD/M/YYYY',
                ll: 'D MMM YYYY',
                lll: 'D MMM YYYY LT',
                llll: 'ddd, D MMM YYYY LT'
            },
            calendar: {
                sameDay: '[Hôm nay lúc] LT',
                nextDay: '[Ng� y mai lúc] LT',
                nextWeek: 'dddd [tuần tới lúc] LT',
                lastDay: '[Hôm qua lúc] LT',
                lastWeek: 'dddd [tuần rồi lúc] LT',
                sameElse: 'L'
            },
            relativeTime: {
                future: '%s tới',
                past: '%s trước',
                s: 'v� i giây',
                m: 'một phút',
                mm: '%d phút',
                h: 'một giờ',
                hh: '%d giờ',
                d: 'một ng� y',
                dd: '%d ng� y',
                M: 'một tháng',
                MM: '%d tháng',
                y: 'một năm',
                yy: '%d năm'
            },
            ordinalParse: /\d{1,2}/,
            ordinal: function (number) {
                return number;
            },
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : chinese (zh-cn)
    // author : suupic : https://github.com/suupic
    // author : Zeno Zeng : https://github.com/zenozeng

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('zh-cn', {
            months: '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
            monthsShort: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
            weekdays: '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
            weekdaysShort: '周日_周一_周二_周三_周四_周五_周六'.split('_'),
            weekdaysMin: '日_一_二_三_四_五_六'.split('_'),
            longDateFormat: {
                LT: 'Ah点mm',
                LTS: 'Ah点m分s秒',
                L: 'YYYY-MM-DD',
                LL: 'YYYY年MMMD日',
                LLL: 'YYYY年MMMD日LT',
                LLLL: 'YYYY年MMMD日ddddLT',
                l: 'YYYY-MM-DD',
                ll: 'YYYY年MMMD日',
                lll: 'YYYY年MMMD日LT',
                llll: 'YYYY年MMMD日ddddLT'
            },
            meridiemParse: /凌晨|早上|上午|中午|下午|晚上/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === '凌晨' || meridiem === '早上' ||
                        meridiem === '上午') {
                    return hour;
                } else if (meridiem === '下午' || meridiem === '晚上') {
                    return hour + 12;
                } else {
                    // '中午'
                    return hour >= 11 ? hour : hour + 12;
                }
            },
            meridiem: function (hour, minute, isLower) {
                var hm = hour * 100 + minute;
                if (hm < 600) {
                    return '凌晨';
                } else if (hm < 900) {
                    return '早上';
                } else if (hm < 1130) {
                    return '上午';
                } else if (hm < 1230) {
                    return '中午';
                } else if (hm < 1800) {
                    return '下午';
                } else {
                    return '晚上';
                }
            },
            calendar: {
                sameDay: function () {
                    return this.minutes() === 0 ? '[今天]Ah[点整]' : '[今天]LT';
                },
                nextDay: function () {
                    return this.minutes() === 0 ? '[明天]Ah[点整]' : '[明天]LT';
                },
                lastDay: function () {
                    return this.minutes() === 0 ? '[昨天]Ah[点整]' : '[昨天]LT';
                },
                nextWeek: function () {
                    var startOfWeek, prefix;
                    startOfWeek = moment().startOf('week');
                    prefix = this.unix() - startOfWeek.unix() >= 7 * 24 * 3600 ? '[下]' : '[本]';
                    return this.minutes() === 0 ? prefix + 'dddAh点整' : prefix + 'dddAh点mm';
                },
                lastWeek: function () {
                    var startOfWeek, prefix;
                    startOfWeek = moment().startOf('week');
                    prefix = this.unix() < startOfWeek.unix() ? '[上]' : '[本]';
                    return this.minutes() === 0 ? prefix + 'dddAh点整' : prefix + 'dddAh点mm';
                },
                sameElse: 'LL'
            },
            ordinalParse: /\d{1,2}(日|月|周)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'd':
                    case 'D':
                    case 'DDD':
                        return number + '日';
                    case 'M':
                        return number + '月';
                    case 'w':
                    case 'W':
                        return number + '周';
                    default:
                        return number;
                }
            },
            relativeTime: {
                future: '%s内',
                past: '%s前',
                s: '� 秒',
                m: '1分钟',
                mm: '%d分钟',
                h: '1小时',
                hh: '%d小时',
                d: '1天',
                dd: '%d天',
                M: '1个月',
                MM: '%d个月',
                y: '1年',
                yy: '%d年'
            },
            week: {
                // GB/T 7408-1994《数据元和交换� �式·信息交换·日期和时间表示法》与ISO 8601:1988等效
                dow: 1, // Monday is the first day of the week.
                doy: 4  // The week that contains Jan 4th is the first week of the year.
            }
        });
    }));
    // moment.js locale configuration
    // locale : traditional chinese (zh-tw)
    // author : Ben : https://github.com/ben-lin

    (function (factory) {
        factory(moment);
    }(function (moment) {
        return moment.defineLocale('zh-tw', {
            months: '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
            monthsShort: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
            weekdays: '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
            weekdaysShort: '週日_週一_週二_週三_週四_週五_週六'.split('_'),
            weekdaysMin: '日_一_二_三_四_五_六'.split('_'),
            longDateFormat: {
                LT: 'Ah點mm',
                LTS: 'Ah點m分s秒',
                L: 'YYYY年MMMD日',
                LL: 'YYYY年MMMD日',
                LLL: 'YYYY年MMMD日LT',
                LLLL: 'YYYY年MMMD日ddddLT',
                l: 'YYYY年MMMD日',
                ll: 'YYYY年MMMD日',
                lll: 'YYYY年MMMD日LT',
                llll: 'YYYY年MMMD日ddddLT'
            },
            meridiemParse: /早上|上午|中午|下午|晚上/,
            meridiemHour: function (hour, meridiem) {
                if (hour === 12) {
                    hour = 0;
                }
                if (meridiem === '早上' || meridiem === '上午') {
                    return hour;
                } else if (meridiem === '中午') {
                    return hour >= 11 ? hour : hour + 12;
                } else if (meridiem === '下午' || meridiem === '晚上') {
                    return hour + 12;
                }
            },
            meridiem: function (hour, minute, isLower) {
                var hm = hour * 100 + minute;
                if (hm < 900) {
                    return '早上';
                } else if (hm < 1130) {
                    return '上午';
                } else if (hm < 1230) {
                    return '中午';
                } else if (hm < 1800) {
                    return '下午';
                } else {
                    return '晚上';
                }
            },
            calendar: {
                sameDay: '[今天]LT',
                nextDay: '[明天]LT',
                nextWeek: '[下]ddddLT',
                lastDay: '[昨天]LT',
                lastWeek: '[上]ddddLT',
                sameElse: 'L'
            },
            ordinalParse: /\d{1,2}(日|月|週)/,
            ordinal: function (number, period) {
                switch (period) {
                    case 'd':
                    case 'D':
                    case 'DDD':
                        return number + '日';
                    case 'M':
                        return number + '月';
                    case 'w':
                    case 'W':
                        return number + '週';
                    default:
                        return number;
                }
            },
            relativeTime: {
                future: '%s內',
                past: '%s前',
                s: '幾秒',
                m: '一分鐘',
                mm: '%d分鐘',
                h: '一小時',
                hh: '%d小時',
                d: '一天',
                dd: '%d天',
                M: '一個月',
                MM: '%d個月',
                y: '一年',
                yy: '%d年'
            }
        });
    }));

    moment.locale('en');


    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    'Accessing Moment through the global scope is ' +
                    'deprecated, and will be removed in an upcoming ' +
                    'release.',
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === 'function' && define.amd) {
        define(function (require, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);







/*! version : 4.15.35
 =========================================================
 bootstrap-datetimejs
 https://github.com/Eonasdan/bootstrap-datetimepicker
 Copyright (c) 2015 Jonathan Peterson
 =========================================================
 */
/*
 The MIT License (MIT)

 Copyright (c) 2015 Jonathan Peterson

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
/*global define:false */
/*global exports:false */
/*global require:false */
/*global jQuery:false */
/*global moment:false */
(function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD is used - Register as an anonymous module.
        define(['jquery', 'moment'], factory);
    } else if (typeof exports === 'object') {
        factory(require('jquery'), require('moment'));
    } else {
        // Neither AMD nor CommonJS used. Use global variables.
        if (typeof jQuery === 'undefined') {
            throw 'bootstrap-datetimepicker requires jQuery to be loaded first';
        }
        if (typeof moment === 'undefined') {
            throw 'bootstrap-datetimepicker requires Moment.js to be loaded first';
        }
        factory(jQuery, moment);
    }
}(function ($, moment) {
    'use strict';
    $('body').bind('DOMMouseScroll', function (e) {
       
        //$('.bootstrap-datetimepicker-widget').hide();
       // $("[data-container='body']").blur();
    });

    //IE, Opera, Safari
    $('body').bind('mousewheel', function (e) {
       
       // $('.bootstrap-datetimepicker-widget').hide();
       // $("[data-container='body']").blur();

    });

    if (!moment) {
        throw new Error('bootstrap-datetimepicker requires Moment.js to be loaded first');
    }

    var dateTimePicker = function (element, options) {
        var picker = {},
            date = moment().startOf('d'),
            viewDate = date.clone(),
            unset = true,
            input,
            component = false,
            widget = false,
            use24Hours,
            minViewModeNumber = 0,
            actualFormat,
            parseFormats,
            currentViewMode,
            datePickerModes = [
                {
                    clsName: 'days',
                    navFnc: 'M',
                    navStep: 1
                },
                {
                    clsName: 'months',
                    navFnc: 'y',
                    navStep: 1
                },
                {
                    clsName: 'years',
                    navFnc: 'y',
                    navStep: 10
                },
                {
                    clsName: 'decades',
                    navFnc: 'y',
                    navStep: 100
                }
            ],
            viewModes = ['days', 'months', 'years', 'decades'],
            verticalModes = ['top', 'bottom', 'auto'],
            horizontalModes = ['left', 'right', 'auto'],
            toolbarPlacements = ['default', 'top', 'bottom'],
            keyMap = {
                'up': 38,
                38: 'up',
                'down': 40,
                40: 'down',
                'left': 37,
                37: 'left',
                'right': 39,
                39: 'right',
                'tab': 9,
                9: 'tab',
                'escape': 27,
                27: 'escape',
                'enter': 13,
                13: 'enter',
                'pageUp': 33,
                33: 'pageUp',
                'pageDown': 34,
                34: 'pageDown',
                'shift': 16,
                16: 'shift',
                'control': 17,
                17: 'control',
                'space': 32,
                32: 'space',
                't': 84,
                84: 't',
                'delete': 46,
                46: 'delete'
            },
            keyState = {},

            /********************************************************************************
             *
             * Private functions
             *
             ********************************************************************************/
            isEnabled = function (granularity) {
                if (typeof granularity !== 'string' || granularity.length > 1) {
                    throw new TypeError('isEnabled expects a single character string parameter');
                }
                switch (granularity) {
                    case 'y':
                        return actualFormat.indexOf('Y') !== -1;
                    case 'M':
                        return actualFormat.indexOf('M') !== -1;
                    case 'd':
                        return actualFormat.toLowerCase().indexOf('d') !== -1;
                    case 'h':
                    case 'H':
                        return actualFormat.toLowerCase().indexOf('h') !== -1;
                    case 'm':
                        return actualFormat.indexOf('m') !== -1;
                    case 's':
                        return actualFormat.indexOf('s') !== -1;
                    default:
                        return false;
                }
            },
            hasTime = function () {
                return (isEnabled('h') || isEnabled('m') || isEnabled('s'));
            },

            hasDate = function () {
                return (isEnabled('y') || isEnabled('M') || isEnabled('d'));
            },

            getDatePickerTemplate = function () {
                var headTemplate = $('<thead>')
                        .append($('<tr>')
                            .append($('<th>').addClass('prev').attr('data-action', 'previous')
                                .append($('<span>').addClass(options.icons.previous))
                                )
                            .append($('<th>').addClass('picker-switch').attr('data-action', 'pickerSwitch').attr('colspan', (options.calendarWeeks ? '6' : '5')))
                            .append($('<th>').addClass('next').attr('data-action', 'next')
                                .append($('<span>').addClass(options.icons.next))
                                )
                            ),
                    contTemplate = $('<tbody>')
                        .append($('<tr>')
                            .append($('<td>').attr('colspan', (options.calendarWeeks ? '8' : '7')))
                            );

                return [
                    $('<div>').addClass('datepicker-days')
                        .append($('<table>').addClass('table-condensed')
                            .append(headTemplate)
                            .append($('<tbody>'))
                            ),
                    $('<div>').addClass('datepicker-months')
                        .append($('<table>').addClass('table-condensed')
                            .append(headTemplate.clone())
                            .append(contTemplate.clone())
                            ),
                    $('<div>').addClass('datepicker-years')
                        .append($('<table>').addClass('table-condensed')
                            .append(headTemplate.clone())
                            .append(contTemplate.clone())
                            ),
                    $('<div>').addClass('datepicker-decades')
                        .append($('<table>').addClass('table-condensed')
                            .append(headTemplate.clone())
                            .append(contTemplate.clone())
                            )
                ];
            },

            getTimePickerMainTemplate = function () {
                var topRow = $('<tr>'),
                    middleRow = $('<tr>'),
                    bottomRow = $('<tr>');

                if (isEnabled('h')) {
                    topRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Increment Hour' }).addClass('btn').attr('data-action', 'incrementHours')
                            .append($('<span>').addClass(options.icons.up))));
                    middleRow.append($('<td>')
                        .append($('<span>').addClass('timepicker-hour').attr({ 'data-time-component': 'hours', 'title': 'Pick Hour' }).attr('data-action', 'showHours')));
                    bottomRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Decrement Hour' }).addClass('btn').attr('data-action', 'decrementHours')
                            .append($('<span>').addClass(options.icons.down))));
                }
                if (isEnabled('m')) {
                    if (isEnabled('h')) {
                        topRow.append($('<td>').addClass('separator'));
                        middleRow.append($('<td>').addClass('separator').html(':'));
                        bottomRow.append($('<td>').addClass('separator'));
                    }
                    topRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Increment Minute' }).addClass('btn').attr('data-action', 'incrementMinutes')
                            .append($('<span>').addClass(options.icons.up))));
                    middleRow.append($('<td>')
                        .append($('<span>').addClass('timepicker-minute').attr({ 'data-time-component': 'minutes', 'title': 'Pick Minute' }).attr('data-action', 'showMinutes')));
                    bottomRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Decrement Minute' }).addClass('btn').attr('data-action', 'decrementMinutes')
                            .append($('<span>').addClass(options.icons.down))));
                }
                if (isEnabled('s')) {
                    if (isEnabled('m')) {
                        topRow.append($('<td>').addClass('separator'));
                        middleRow.append($('<td>').addClass('separator').html(':'));
                        bottomRow.append($('<td>').addClass('separator'));
                    }
                    topRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Increment Second' }).addClass('btn').attr('data-action', 'incrementSeconds')
                            .append($('<span>').addClass(options.icons.up))));
                    middleRow.append($('<td>')
                        .append($('<span>').addClass('timepicker-second').attr({ 'data-time-component': 'seconds', 'title': 'Pick Second' }).attr('data-action', 'showSeconds')));
                    bottomRow.append($('<td>')
                        .append($('<a>').attr({ href: '#', tabindex: '-1', 'title': 'Decrement Second' }).addClass('btn').attr('data-action', 'decrementSeconds')
                            .append($('<span>').addClass(options.icons.down))));
                }

                if (!use24Hours) {
                    topRow.append($('<td>').addClass('separator'));
                    middleRow.append($('<td>')
                        .append($('<button>').addClass('btn btn-primary').attr({ 'data-action': 'togglePeriod', tabindex: '-1', 'title': 'Toggle Period' })));
                    bottomRow.append($('<td>').addClass('separator'));
                }

                return $('<div>').addClass('timepicker-picker')
                    .append($('<table>').addClass('table-condensed')
                        .append([topRow, middleRow, bottomRow]));
            },

            getTimePickerTemplate = function () {
                var hoursView = $('<div>').addClass('timepicker-hours')
                        .append($('<table>').addClass('table-condensed')),
                    minutesView = $('<div>').addClass('timepicker-minutes')
                        .append($('<table>').addClass('table-condensed')),
                    secondsView = $('<div>').addClass('timepicker-seconds')
                        .append($('<table>').addClass('table-condensed')),
                    ret = [getTimePickerMainTemplate()];

                if (isEnabled('h')) {
                    ret.push(hoursView);
                }
                if (isEnabled('m')) {
                    ret.push(minutesView);
                }
                if (isEnabled('s')) {
                    ret.push(secondsView);
                }

                return ret;
            },

            getToolbar = function () {
                var row = [];
                if (options.showTodayButton) {
                    row.push($('<td>').append($('<a>').attr({ 'data-action': 'today', 'title': options.tooltips.today }).append($('<span>').addClass(options.icons.today))));
                }
                if (!options.sideBySide && hasDate() && hasTime()) {
                    row.push($('<td>').append($('<a>').attr({ 'data-action': 'togglePicker', 'title': 'Select Time' }).append($('<span>').addClass(options.icons.time))));
                }
                if (options.showClear) {
                    row.push($('<td>').append($('<a>').attr({ 'data-action': 'clear', 'title': options.tooltips.clear }).append($('<span>').addClass(options.icons.clear))));
                }
                if (options.showClose) {
                    row.push($('<td>').append($('<a>').attr({ 'data-action': 'close', 'title': options.tooltips.close }).append($('<span>').addClass(options.icons.close))));
                }
                return $('<table>').addClass('table-condensed').append($('<tbody>').append($('<tr>').append(row)));
            },

            getTemplate = function () {
                var template = $('<div>').addClass('bootstrap-datetimepicker-widget dropdown-menu'),
                    dateView = $('<div>').addClass('datepicker').append(getDatePickerTemplate()),
                    timeView = $('<div>').addClass('timepicker').append(getTimePickerTemplate()),
                    content = $('<ul>').addClass('list-unstyled'),
                    toolbar = $('<li>').addClass('picker-switch' + (options.collapse ? ' accordion-toggle' : '')).append(getToolbar());

                if (options.inline) {
                    template.removeClass('dropdown-menu');
                }

                if (use24Hours) {
                    template.addClass('usetwentyfour');
                }
                if (isEnabled('s') && !use24Hours) {
                    template.addClass('wider');
                }

                if (options.sideBySide && hasDate() && hasTime()) {
                    template.addClass('timepicker-sbs');
                    if (options.toolbarPlacement === 'top') {
                        template.append(toolbar);
                    }
                    template.append(
                        $('<div>').addClass('row')
                            .append(dateView.addClass('col-md-6'))
                            .append(timeView.addClass('col-md-6'))
                    );
                    if (options.toolbarPlacement === 'bottom') {
                        template.append(toolbar);
                    }
                    return template;
                }

                if (options.toolbarPlacement === 'top') {
                    content.append(toolbar);
                }
                if (hasDate()) {
                    content.append($('<li>').addClass((options.collapse && hasTime() ? 'collapse in' : '')).append(dateView));
                }
                if (options.toolbarPlacement === 'default') {
                    content.append(toolbar);
                }
                if (hasTime()) {
                    content.append($('<li>').addClass((options.collapse && hasDate() ? 'collapse' : '')).append(timeView));
                }
                if (options.toolbarPlacement === 'bottom') {
                    content.append(toolbar);
                }
                return template.append(content);
            },

            dataToOptions = function () {
                var eData,
                    dataOptions = {};

                if (element.is('input') || options.inline) {
                    eData = element.data();
                } else {
                    eData = element.find('input').data();
                }

                if (eData.dateOptions && eData.dateOptions instanceof Object) {
                    dataOptions = $.extend(true, dataOptions, eData.dateOptions);
                }

                $.each(options, function (key) {
                    var attributeName = 'date' + key.charAt(0).toUpperCase() + key.slice(1);
                    if (eData[attributeName] !== undefined) {
                        dataOptions[key] = eData[attributeName];
                    }
                });
                return dataOptions;
            },

            place = function () {
                //console.log('place');
                var position = (component || element).position(),
                    offset = (component || element).offset(),
                    vertical = options.widgetPositioning.vertical,
                    horizontal = options.widgetPositioning.horizontal,
                    parent;

                if (options.widgetParent) {
                    parent = options.widgetParent.append(widget);
                } else if (element.is('input')) {
                    parent = element.after(widget).parent();
                } else if (options.inline) {
                    parent = element.append(widget);
                    return;
                } else {
                    parent = element;
                    element.children().first().after(widget);
                }

                // Top and bottom logic
                if (vertical === 'auto') {
                    if (offset.top + widget.height() * 1.5 >= $(window).height() + $(window).scrollTop() &&
                        widget.height() + element.outerHeight() < offset.top) {
                        vertical = 'top';
                    } else {
                        vertical = 'bottom';
                    }
                }

                // Left and right logic
                if (horizontal === 'auto') {
                    if (parent.width() < offset.left + widget.outerWidth() / 2 &&
                        offset.left + widget.outerWidth() > $(window).width()) {
                        horizontal = 'right';
                    } else {
                        horizontal = 'left';
                    }
                }

                if (vertical === 'top') {
                    widget.addClass('top').removeClass('bottom');
                } else {
                    widget.addClass('bottom').removeClass('top');
                }

                if (horizontal === 'right') {
                    widget.addClass('pull-right');
                } else {
                    widget.removeClass('pull-right');
                }

                // find the first parent element that has a relative css positioning
                if (parent.css('position') !== 'relative') {
                    parent = parent.parents().filter(function () {
                        return $(this).css('position') === 'relative';
                    }).first();
                }

                if (parent.length === 0) {
                    throw new Error('datetimepicker component should be placed within a relative positioned container');
                }

                widget.css({
                    top: vertical === 'top' ? position.top - 18 - widget.height() : position.top + element.outerHeight() + 3,
                    bottom: vertical === 'top' ? 'auto' : 'auto',
                    left: horizontal === 'left' ? 25 : 'auto',
                    //left: horizontal === 'left' ? (parent === element ? 0 : position.left) : 'auto',
                    right: horizontal === 'left' ? 'auto' : parent.outerWidth() - element.outerWidth() - (parent === element ? 0 : position.left)
                });
            },

            notifyEvent = function (e) {
                if (e.type === 'dp.change' && ((e.date && e.date.isSame(e.oldDate)) || (!e.date && !e.oldDate))) {
                    return;
                }
                element.trigger(e);
            },

            viewUpdate = function (e) {
                if (e === 'y') {
                    e = 'YYYY';
                }
                notifyEvent({
                    type: 'dp.update',
                    change: e,
                    viewDate: viewDate.clone()
                });
            },

            showMode = function (dir) {
                if (!widget) {
                    return;
                }
                if (dir) {
                    currentViewMode = Math.max(minViewModeNumber, Math.min(3, currentViewMode + dir));
                }
                widget.find('.datepicker > div').hide().filter('.datepicker-' + datePickerModes[currentViewMode].clsName).show();
            },

            fillDow = function () {
                var row = $('<tr>'),
                    currentDate = viewDate.clone().startOf('w').startOf('d');

                if (options.calendarWeeks === true) {
                    row.append($('<th>').addClass('cw').text('#'));
                }

                while (currentDate.isBefore(viewDate.clone().endOf('w'))) {
                    row.append($('<th>').addClass('dow').text(currentDate.format('dd')));
                    currentDate.add(1, 'd');
                }
                widget.find('.datepicker-days thead').append(row);
            },

            isInDisabledDates = function (testDate) {
                return options.disabledDates[testDate.format('YYYY-MM-DD')] === true;
            },

            isInEnabledDates = function (testDate) {
                return options.enabledDates[testDate.format('YYYY-MM-DD')] === true;
            },

            isInDisabledHours = function (testDate) {
                return options.disabledHours[testDate.format('H')] === true;
            },

            isInEnabledHours = function (testDate) {
                return options.enabledHours[testDate.format('H')] === true;
            },

            isValid = function (targetMoment, granularity) {
                if (!targetMoment.isValid()) {
                    return false;
                }
                if (options.disabledDates && granularity === 'd' && isInDisabledDates(targetMoment)) {
                    return false;
                }
                if (options.enabledDates && granularity === 'd' && !isInEnabledDates(targetMoment)) {
                    return false;
                }
                if (options.minDate && targetMoment.isBefore(options.minDate, granularity)) {
                    return false;
                }
                if (options.maxDate && targetMoment.isAfter(options.maxDate, granularity)) {
                    return false;
                }
                if (options.daysOfWeekDisabled && granularity === 'd' && options.daysOfWeekDisabled.indexOf(targetMoment.day()) !== -1) {
                    return false;
                }
                if (options.disabledHours && (granularity === 'h' || granularity === 'm' || granularity === 's') && isInDisabledHours(targetMoment)) {
                    return false;
                }
                if (options.enabledHours && (granularity === 'h' || granularity === 'm' || granularity === 's') && !isInEnabledHours(targetMoment)) {
                    return false;
                }
                if (options.disabledTimeIntervals && (granularity === 'h' || granularity === 'm' || granularity === 's')) {
                    var found = false;
                    $.each(options.disabledTimeIntervals, function () {
                        if (targetMoment.isBetween(this[0], this[1])) {
                            found = true;
                            return false;
                        }
                    });
                    if (found) {
                        return false;
                    }
                }
                return true;
            },

            fillMonths = function () {
                var spans = [],
                    monthsShort = viewDate.clone().startOf('y').startOf('d');
                while (monthsShort.isSame(viewDate, 'y')) {
                    spans.push($('<span>').attr('data-action', 'selectMonth').addClass('month').text(monthsShort.format('MMM')));
                    monthsShort.add(1, 'M');
                }
                widget.find('.datepicker-months td').empty().append(spans);
            },

            updateMonths = function () {
                var monthsView = widget.find('.datepicker-months'),
                    monthsViewHeader = monthsView.find('th'),
                    months = monthsView.find('tbody').find('span');

                monthsViewHeader.eq(0).find('span').attr('title', options.tooltips.prevYear);
                monthsViewHeader.eq(1).attr('title', options.tooltips.selectYear);
                monthsViewHeader.eq(2).find('span').attr('title', options.tooltips.nextYear);

                monthsView.find('.disabled').removeClass('disabled');

                if (!isValid(viewDate.clone().subtract(1, 'y'), 'y')) {
                    monthsViewHeader.eq(0).addClass('disabled');
                }

                monthsViewHeader.eq(1).text(viewDate.year());

                if (!isValid(viewDate.clone().add(1, 'y'), 'y')) {
                    monthsViewHeader.eq(2).addClass('disabled');
                }

                months.removeClass('active');
                if (date.isSame(viewDate, 'y') && !unset) {
                    months.eq(date.month()).addClass('active');
                }

                months.each(function (index) {
                    if (!isValid(viewDate.clone().month(index), 'M')) {
                        $(this).addClass('disabled');
                    }
                });
            },

            updateYears = function () {
                var yearsView = widget.find('.datepicker-years'),
                    yearsViewHeader = yearsView.find('th'),
                    startYear = viewDate.clone().subtract(5, 'y'),
                    endYear = viewDate.clone().add(6, 'y'),
                    html = '';

                yearsViewHeader.eq(0).find('span').attr('title', options.tooltips.nextDecade);
                yearsViewHeader.eq(1).attr('title', options.tooltips.selectDecade);
                yearsViewHeader.eq(2).find('span').attr('title', options.tooltips.prevDecade);

                yearsView.find('.disabled').removeClass('disabled');

                if (options.minDate && options.minDate.isAfter(startYear, 'y')) {
                    yearsViewHeader.eq(0).addClass('disabled');
                }

                yearsViewHeader.eq(1).text(startYear.year() + '-' + endYear.year());

                if (options.maxDate && options.maxDate.isBefore(endYear, 'y')) {
                    yearsViewHeader.eq(2).addClass('disabled');
                }

                while (!startYear.isAfter(endYear, 'y')) {
                    html += '<span data-action="selectYear" class="year' + (startYear.isSame(date, 'y') && !unset ? ' active' : '') + (!isValid(startYear, 'y') ? ' disabled' : '') + '">' + startYear.year() + '</span>';
                    startYear.add(1, 'y');
                }

                yearsView.find('td').html(html);
            },

            updateDecades = function () {
                var decadesView = widget.find('.datepicker-decades'),
                    decadesViewHeader = decadesView.find('th'),
                    startDecade = viewDate.isBefore(moment({ y: 1999 })) ? moment({ y: 1899 }) : moment({ y: 1999 }),
                    endDecade = startDecade.clone().add(100, 'y'),
                    html = '';

                decadesViewHeader.eq(0).find('span').attr('title', options.tooltips.prevCentury);
                decadesViewHeader.eq(2).find('span').attr('title', options.tooltips.nextCentury);

                decadesView.find('.disabled').removeClass('disabled');

                if (startDecade.isSame(moment({ y: 1900 })) || (options.minDate && options.minDate.isAfter(startDecade, 'y'))) {
                    decadesViewHeader.eq(0).addClass('disabled');
                }

                decadesViewHeader.eq(1).text(startDecade.year() + '-' + endDecade.year());

                if (startDecade.isSame(moment({ y: 2000 })) || (options.maxDate && options.maxDate.isBefore(endDecade, 'y'))) {
                    decadesViewHeader.eq(2).addClass('disabled');
                }

                while (!startDecade.isAfter(endDecade, 'y')) {
                    html += '<span data-action="selectDecade" class="decade' + (startDecade.isSame(date, 'y') ? ' active' : '') +
                        (!isValid(startDecade, 'y') ? ' disabled' : '') + '" data-selection="' + (startDecade.year() + 6) + '">' + (startDecade.year() + 1) + ' - ' + (startDecade.year() + 12) + '</span>';
                    startDecade.add(12, 'y');
                }
                html += '<span></span><span></span><span></span>'; //push the dangling block over, at least this way it's even

                decadesView.find('td').html(html);
            },

            fillDate = function () {
                var daysView = widget.find('.datepicker-days'),
                    daysViewHeader = daysView.find('th'),
                    currentDate,
                    html = [],
                    row,
                    clsName,
                    i;

                if (!hasDate()) {
                    return;
                }

                daysViewHeader.eq(0).find('span').attr('title', options.tooltips.prevMonth);
                daysViewHeader.eq(1).attr('title', options.tooltips.selectMonth);
                daysViewHeader.eq(2).find('span').attr('title', options.tooltips.nextMonth);

                daysView.find('.disabled').removeClass('disabled');
                daysViewHeader.eq(1).text(viewDate.format(options.dayViewHeaderFormat));

                if (!isValid(viewDate.clone().subtract(1, 'M'), 'M')) {
                    daysViewHeader.eq(0).addClass('disabled');
                }
                if (!isValid(viewDate.clone().add(1, 'M'), 'M')) {
                    daysViewHeader.eq(2).addClass('disabled');
                }

                currentDate = viewDate.clone().startOf('M').startOf('w').startOf('d');

                for (i = 0; i < 42; i++) { //always display 42 days (should show 6 weeks)
                    if (currentDate.weekday() === 0) {
                        row = $('<tr>');
                        if (options.calendarWeeks) {
                            row.append('<td class="cw">' + currentDate.week() + '</td>');
                        }
                        html.push(row);
                    }
                    clsName = '';
                    if (currentDate.isBefore(viewDate, 'M')) {
                        clsName += ' old';
                    }
                    if (currentDate.isAfter(viewDate, 'M')) {
                        clsName += ' new';
                    }
                    if (currentDate.isSame(date, 'd') && !unset) {
                        clsName += ' active';
                    }
                    if (!isValid(currentDate, 'd')) {
                        clsName += ' disabled';
                    }
                    if (currentDate.isSame(moment(), 'd')) {
                        clsName += ' today';
                    }
                    if (currentDate.day() === 0 || currentDate.day() === 6) {
                        clsName += ' weekend';
                    }
                    row.append('<td data-action="selectDay" data-day="' + currentDate.format('L') + '" class="day' + clsName + '">' + currentDate.date() + '</td>');
                    currentDate.add(1, 'd');
                }

                daysView.find('tbody').empty().append(html);

                updateMonths();

                updateYears();

                updateDecades();
            },

            fillHours = function () {
                var table = widget.find('.timepicker-hours table'),
                    currentHour = viewDate.clone().startOf('d'),
                    html = [],
                    row = $('<tr>');

                if (viewDate.hour() > 11 && !use24Hours) {
                    currentHour.hour(12);
                }
                while (currentHour.isSame(viewDate, 'd') && (use24Hours || (viewDate.hour() < 12 && currentHour.hour() < 12) || viewDate.hour() > 11)) {
                    if (currentHour.hour() % 4 === 0) {
                        row = $('<tr>');
                        html.push(row);
                    }
                    row.append('<td data-action="selectHour" class="hour' + (!isValid(currentHour, 'h') ? ' disabled' : '') + '">' + currentHour.format(use24Hours ? 'HH' : 'hh') + '</td>');
                    currentHour.add(1, 'h');
                }
                table.empty().append(html);
            },

            fillMinutes = function () {
                var table = widget.find('.timepicker-minutes table'),
                    currentMinute = viewDate.clone().startOf('h'),
                    html = [],
                    row = $('<tr>'),
                    step = options.stepping === 1 ? 5 : options.stepping;

                while (viewDate.isSame(currentMinute, 'h')) {
                    if (currentMinute.minute() % (step * 4) === 0) {
                        row = $('<tr>');
                        html.push(row);
                    }
                    row.append('<td data-action="selectMinute" class="minute' + (!isValid(currentMinute, 'm') ? ' disabled' : '') + '">' + currentMinute.format('mm') + '</td>');
                    currentMinute.add(step, 'm');
                }
                table.empty().append(html);
            },

            fillSeconds = function () {
                var table = widget.find('.timepicker-seconds table'),
                    currentSecond = viewDate.clone().startOf('m'),
                    html = [],
                    row = $('<tr>');

                while (viewDate.isSame(currentSecond, 'm')) {
                    if (currentSecond.second() % 20 === 0) {
                        row = $('<tr>');
                        html.push(row);
                    }
                    row.append('<td data-action="selectSecond" class="second' + (!isValid(currentSecond, 's') ? ' disabled' : '') + '">' + currentSecond.format('ss') + '</td>');
                    currentSecond.add(5, 's');
                }

                table.empty().append(html);
            },

            fillTime = function () {
                var toggle, newDate, timeComponents = widget.find('.timepicker span[data-time-component]');

                if (!use24Hours) {
                    toggle = widget.find('.timepicker [data-action=togglePeriod]');
                    newDate = date.clone().add((date.hours() >= 12) ? -12 : 12, 'h');

                    toggle.text(date.format('A'));

                    if (isValid(newDate, 'h')) {
                        toggle.removeClass('disabled');
                    } else {
                        toggle.addClass('disabled');
                    }
                }
                timeComponents.filter('[data-time-component=hours]').text(date.format(use24Hours ? 'HH' : 'hh'));
                timeComponents.filter('[data-time-component=minutes]').text(date.format('mm'));
                timeComponents.filter('[data-time-component=seconds]').text(date.format('ss'));

                fillHours();
                fillMinutes();
                fillSeconds();
            },

            update = function () {
                if (!widget) {
                    return;
                }
                fillDate();
                fillTime();
            },

            setValue = function (targetMoment) {
                var oldDate = unset ? null : date;

                // case of calling setValue(null or false)
                if (!targetMoment) {
                    unset = true;
                    input.val('');
                    element.data('date', '');
                    notifyEvent({
                        type: 'dp.change',
                        date: false,
                        oldDate: oldDate
                    });
                    update();
                    return;
                }

                targetMoment = targetMoment.clone().locale(options.locale);

                if (options.stepping !== 1) {
                    targetMoment.minutes((Math.round(targetMoment.minutes() / options.stepping) * options.stepping) % 60).seconds(0);
                }

                if (isValid(targetMoment)) {
                    date = targetMoment;
                    viewDate = date.clone();
                    input.val(date.format(actualFormat));
                    element.data('date', date.format(actualFormat));
                    unset = false;
                    update();
                    notifyEvent({
                        type: 'dp.change',
                        date: date.clone(),
                        oldDate: oldDate
                    });
                } else {
                    if (!options.keepInvalid) {
                        input.val(unset ? '' : date.format(actualFormat));
                    }
                    notifyEvent({
                        type: 'dp.error',
                        date: targetMoment
                    });
                }
            },

            hide = function () {
                ///<summary>Hides the widget. Possibly will emit dp.hide</summary>
                var transitioning = false;
                if (!widget) {
                    return picker;
                }
                // Ignore event if in the middle of a picker transition
                widget.find('.collapse').each(function () {
                    var collapseData = $(this).data('collapse');
                    if (collapseData && collapseData.transitioning) {
                        transitioning = true;
                        return false;
                    }
                    return true;
                });
                if (transitioning) {
                    return picker;
                }
                if (component && component.hasClass('btn')) {
                    component.toggleClass('active');
                }
                widget.hide();

                $(window).off('resize', place);
                widget.off('click', '[data-action]');
                widget.off('mousedown', false);

                widget.remove();
                widget = false;

                notifyEvent({
                    type: 'dp.hide',
                    date: date.clone()
                });

                input.blur();

                return picker;
            },

            clear = function () {
                setValue(null);
            },

            /********************************************************************************
             *
             * Widget UI interaction functions
             *
             ********************************************************************************/
            actions = {
                next: function () {
                    var navFnc = datePickerModes[currentViewMode].navFnc;
                    viewDate.add(datePickerModes[currentViewMode].navStep, navFnc);
                    fillDate();
                    viewUpdate(navFnc);
                },

                previous: function () {
                    var navFnc = datePickerModes[currentViewMode].navFnc;
                    viewDate.subtract(datePickerModes[currentViewMode].navStep, navFnc);
                    fillDate();
                    viewUpdate(navFnc);
                },

                pickerSwitch: function () {
                    showMode(1);
                },

                selectMonth: function (e) {
                    var month = $(e.target).closest('tbody').find('span').index($(e.target));
                    viewDate.month(month);
                    if (currentViewMode === minViewModeNumber) {
                        setValue(date.clone().year(viewDate.year()).month(viewDate.month()));
                        if (!options.inline) {
                            hide();
                        }
                    } else {
                        showMode(-1);
                        fillDate();
                    }
                    viewUpdate('M');
                },

                selectYear: function (e) {
                    var year = parseInt($(e.target).text(), 10) || 0;
                    viewDate.year(year);
                    if (currentViewMode === minViewModeNumber) {
                        setValue(date.clone().year(viewDate.year()));
                        if (!options.inline) {
                            hide();
                        }
                    } else {
                        showMode(-1);
                        fillDate();
                    }
                    viewUpdate('YYYY');
                },

                selectDecade: function (e) {
                    var year = parseInt($(e.target).data('selection'), 10) || 0;
                    viewDate.year(year);
                    if (currentViewMode === minViewModeNumber) {
                        setValue(date.clone().year(viewDate.year()));
                        if (!options.inline) {
                            hide();
                        }
                    } else {
                        showMode(-1);
                        fillDate();
                    }
                    viewUpdate('YYYY');
                },

                selectDay: function (e) {
                    var day = viewDate.clone();
                    if ($(e.target).is('.old')) {
                        day.subtract(1, 'M');
                    }
                    if ($(e.target).is('.new')) {
                        day.add(1, 'M');
                    }
                    setValue(day.date(parseInt($(e.target).text(), 10)));
                    if (!hasTime() && !options.keepOpen && !options.inline) {
                        hide();
                    }
                },

                incrementHours: function () {
                    var newDate = date.clone().add(1, 'h');
                    if (isValid(newDate, 'h')) {
                        setValue(newDate);
                    }
                },

                incrementMinutes: function () {
                    var newDate = date.clone().add(options.stepping, 'm');
                    if (isValid(newDate, 'm')) {
                        setValue(newDate);
                    }
                },

                incrementSeconds: function () {
                    var newDate = date.clone().add(1, 's');
                    if (isValid(newDate, 's')) {
                        setValue(newDate);
                    }
                },

                decrementHours: function () {
                    var newDate = date.clone().subtract(1, 'h');
                    if (isValid(newDate, 'h')) {
                        setValue(newDate);
                    }
                },

                decrementMinutes: function () {
                    var newDate = date.clone().subtract(options.stepping, 'm');
                    if (isValid(newDate, 'm')) {
                        setValue(newDate);
                    }
                },

                decrementSeconds: function () {
                    var newDate = date.clone().subtract(1, 's');
                    if (isValid(newDate, 's')) {
                        setValue(newDate);
                    }
                },

                togglePeriod: function () {
                    setValue(date.clone().add((date.hours() >= 12) ? -12 : 12, 'h'));
                },

                togglePicker: function (e) {
                    var $this = $(e.target),
                        $parent = $this.closest('ul'),
                        expanded = $parent.find('.in'),
                        closed = $parent.find('.collapse:not(.in)'),
                        collapseData;

                    if (expanded && expanded.length) {
                        collapseData = expanded.data('collapse');
                        if (collapseData && collapseData.transitioning) {
                            return;
                        }
                        if (expanded.collapse) { // if collapse plugin is available through bootstrap.js then use it
                            expanded.collapse('hide');
                            closed.collapse('show');
                        } else { // otherwise just toggle in class on the two views
                            expanded.removeClass('in');
                            closed.addClass('in');
                        }
                        if ($this.is('span')) {
                            $this.toggleClass(options.icons.time + ' ' + options.icons.date);
                        } else {
                            $this.find('span').toggleClass(options.icons.time + ' ' + options.icons.date);
                        }

                        // NOTE: uncomment if toggled state will be restored in show()
                        //if (component) {
                        //    component.find('span').toggleClass(options.icons.time + ' ' + options.icons.date);
                        //}
                    }
                },

                showPicker: function () {
                    widget.find('.timepicker > div:not(.timepicker-picker)').hide();
                    widget.find('.timepicker .timepicker-picker').show();
                },

                showHours: function () {
                    widget.find('.timepicker .timepicker-picker').hide();
                    widget.find('.timepicker .timepicker-hours').show();
                },

                showMinutes: function () {
                    widget.find('.timepicker .timepicker-picker').hide();
                    widget.find('.timepicker .timepicker-minutes').show();
                },

                showSeconds: function () {
                    widget.find('.timepicker .timepicker-picker').hide();
                    widget.find('.timepicker .timepicker-seconds').show();
                },

                selectHour: function (e) {
                    var hour = parseInt($(e.target).text(), 10);

                    if (!use24Hours) {
                        if (date.hours() >= 12) {
                            if (hour !== 12) {
                                hour += 12;
                            }
                        } else {
                            if (hour === 12) {
                                hour = 0;
                            }
                        }
                    }
                    setValue(date.clone().hours(hour));
                    actions.showPicker.call(picker);
                },

                selectMinute: function (e) {
                    setValue(date.clone().minutes(parseInt($(e.target).text(), 10)));
                    actions.showPicker.call(picker);
                },

                selectSecond: function (e) {
                    setValue(date.clone().seconds(parseInt($(e.target).text(), 10)));
                    actions.showPicker.call(picker);
                },

                clear: clear,

                today: function () {
                    if (isValid(moment(), 'd')) {
                        setValue(moment());
                    }
                },

                close: hide
            },

            doAction = function (e) {
                if ($(e.currentTarget).is('.disabled')) {
                    return false;
                }
                actions[$(e.currentTarget).data('action')].apply(picker, arguments);
                return false;
            },

            show = function () {
                ///<summary>Shows the widget. Possibly will emit dp.show and dp.change</summary>
                var currentMoment,
                    useCurrentGranularity = {
                        'year': function (m) {
                            return m.month(0).date(1).hours(0).seconds(0).minutes(0);
                        },
                        'month': function (m) {
                            return m.date(1).hours(0).seconds(0).minutes(0);
                        },
                        'day': function (m) {
                            return m.hours(0).seconds(0).minutes(0);
                        },
                        'hour': function (m) {
                            return m.seconds(0).minutes(0);
                        },
                        'minute': function (m) {
                            return m.seconds(0);
                        }
                    };

                if (input.prop('disabled') || (!options.ignoreReadonly && input.prop('readonly')) || widget) {
                    return picker;
                }
                if (input.val() !== undefined && input.val().trim().length !== 0) {
                    setValue(parseInputDate(input.val().trim()));
                } else if (options.useCurrent && unset && ((input.is('input') && input.val().trim().length === 0) || options.inline)) {
                    currentMoment = moment();
                    if (typeof options.useCurrent === 'string') {
                        currentMoment = useCurrentGranularity[options.useCurrent](currentMoment);
                    }
                    setValue(currentMoment);
                }

                widget = getTemplate();

                fillDow();
                fillMonths();

                widget.find('.timepicker-hours').hide();
                widget.find('.timepicker-minutes').hide();
                widget.find('.timepicker-seconds').hide();

                update();
                showMode();

                $(window).on('resize', place);
                widget.on('click', '[data-action]', doAction); // this handles clicks on the widget
                widget.on('mousedown', false);

                if (component && component.hasClass('btn')) {
                    component.toggleClass('active');
                }
                widget.show();
                place();

                if (options.focusOnShow && !input.is(':focus')) {
                    input.focus();
                }

                notifyEvent({
                    type: 'dp.show'
                });
                return picker;
            },

            toggle = function () {
                /// <summary>Shows or hides the widget</summary>
                return (widget ? hide() : show());
            },

            parseInputDate = function (inputDate) {
                if (options.parseInputDate === undefined) {
                    if (moment.isMoment(inputDate) || inputDate instanceof Date) {
                        inputDate = moment(inputDate);
                    } else {
                        inputDate = moment(inputDate, parseFormats, options.useStrict);
                    }
                } else {
                    inputDate = options.parseInputDate(inputDate);
                }
                inputDate.locale(options.locale);
                return inputDate;
            },

            keydown = function (e) {
                var handler = null,
                    index,
                    index2,
                    pressedKeys = [],
                    pressedModifiers = {},
                    currentKey = e.which,
                    keyBindKeys,
                    allModifiersPressed,
                    pressed = 'p';

                keyState[currentKey] = pressed;

                for (index in keyState) {
                    if (keyState.hasOwnProperty(index) && keyState[index] === pressed) {
                        pressedKeys.push(index);
                        if (parseInt(index, 10) !== currentKey) {
                            pressedModifiers[index] = true;
                        }
                    }
                }

                for (index in options.keyBinds) {
                    if (options.keyBinds.hasOwnProperty(index) && typeof (options.keyBinds[index]) === 'function') {
                        keyBindKeys = index.split(' ');
                        if (keyBindKeys.length === pressedKeys.length && keyMap[currentKey] === keyBindKeys[keyBindKeys.length - 1]) {
                            allModifiersPressed = true;
                            for (index2 = keyBindKeys.length - 2; index2 >= 0; index2--) {
                                if (!(keyMap[keyBindKeys[index2]] in pressedModifiers)) {
                                    allModifiersPressed = false;
                                    break;
                                }
                            }
                            if (allModifiersPressed) {
                                handler = options.keyBinds[index];
                                break;
                            }
                        }
                    }
                }

                if (handler) {
                    handler.call(picker, widget);
                    e.stopPropagation();
                    e.preventDefault();
                }
            },

            keyup = function (e) {
                keyState[e.which] = 'r';
                e.stopPropagation();
                e.preventDefault();
            },

            change = function (e) {
                var val = $(e.target).val().trim(),
                    parsedDate = val ? parseInputDate(val) : null;
                setValue(parsedDate);
                e.stopImmediatePropagation();
                return false;
            },

            attachDatePickerElementEvents = function () {
                input.on({
                    'change': change,
                    'blur': options.debug ? '' : hide,
                    'keydown': keydown,
                    'keyup': keyup,
                    'focus': options.allowInputToggle ? show : ''
                });

                if (element.is('input')) {
                    input.on({
                        'focus': show
                    });
                } else if (component) {
                    component.on('click', toggle);
                    component.on('mousedown', false);
                }
            },

            detachDatePickerElementEvents = function () {
                input.off({
                    'change': change,
                    'blur': blur,
                    'keydown': keydown,
                    'keyup': keyup,
                    'focus': options.allowInputToggle ? hide : ''
                });

                if (element.is('input')) {
                    input.off({
                        'focus': show
                    });
                } else if (component) {
                    component.off('click', toggle);
                    component.off('mousedown', false);
                }
            },

            indexGivenDates = function (givenDatesArray) {
                // Store given enabledDates and disabledDates as keys.
                // This way we can check their existence in O(1) time instead of looping through whole array.
                // (for example: options.enabledDates['2014-02-27'] === true)
                var givenDatesIndexed = {};
                $.each(givenDatesArray, function () {
                    var dDate = parseInputDate(this);
                    if (dDate.isValid()) {
                        givenDatesIndexed[dDate.format('YYYY-MM-DD')] = true;
                    }
                });
                return (Object.keys(givenDatesIndexed).length) ? givenDatesIndexed : false;
            },

            indexGivenHours = function (givenHoursArray) {
                // Store given enabledHours and disabledHours as keys.
                // This way we can check their existence in O(1) time instead of looping through whole array.
                // (for example: options.enabledHours['2014-02-27'] === true)
                var givenHoursIndexed = {};
                $.each(givenHoursArray, function () {
                    givenHoursIndexed[this] = true;
                });
                return (Object.keys(givenHoursIndexed).length) ? givenHoursIndexed : false;
            },

            initFormatting = function () {
                var format = options.format || 'L LT';

                actualFormat = format.replace(/(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g, function (formatInput) {
                    var newinput = date.localeData().longDateFormat(formatInput) || formatInput;
                    return newinput.replace(/(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g, function (formatInput2) { //temp fix for #740
                        return date.localeData().longDateFormat(formatInput2) || formatInput2;
                    });
                });


                parseFormats = options.extraFormats ? options.extraFormats.slice() : [];
                if (parseFormats.indexOf(format) < 0 && parseFormats.indexOf(actualFormat) < 0) {
                    parseFormats.push(actualFormat);
                }

                use24Hours = (actualFormat.toLowerCase().indexOf('a') < 1 && actualFormat.replace(/\[.*?\]/g, '').indexOf('h') < 1);

                if (isEnabled('y')) {
                    minViewModeNumber = 2;
                }
                if (isEnabled('M')) {
                    minViewModeNumber = 1;
                }
                if (isEnabled('d')) {
                    minViewModeNumber = 0;
                }

                currentViewMode = Math.max(minViewModeNumber, currentViewMode);

                if (!unset) {
                    setValue(date);
                }
            };

        /********************************************************************************
         *
         * Public API functions
         * =====================
         *
         * Important: Do not expose direct references to private objects or the options
         * object to the outer world. Always return a clone when returning values or make
         * a clone when setting a private variable.
         *
         ********************************************************************************/
        picker.destroy = function () {
            ///<summary>Destroys the widget and removes all attached event listeners</summary>
            hide();
            detachDatePickerElementEvents();
            element.removeData('DateTimePicker');
            element.removeData('date');
        };

        picker.toggle = toggle;

        picker.show = show;

        picker.hide = hide;

        picker.disable = function () {
            ///<summary>Disables the input element, the component is attached to, by adding a disabled="true" attribute to it.
            ///If the widget was visible before that call it is hidden. Possibly emits dp.hide</summary>
            hide();
            if (component && component.hasClass('btn')) {
                component.addClass('disabled');
            }
            input.prop('disabled', true);
            return picker;
        };

        picker.enable = function () {
            ///<summary>Enables the input element, the component is attached to, by removing disabled attribute from it.</summary>
            if (component && component.hasClass('btn')) {
                component.removeClass('disabled');
            }
            input.prop('disabled', false);
            return picker;
        };

        picker.ignoreReadonly = function (ignoreReadonly) {
            if (arguments.length === 0) {
                return options.ignoreReadonly;
            }
            if (typeof ignoreReadonly !== 'boolean') {
                throw new TypeError('ignoreReadonly () expects a boolean parameter');
            }
            options.ignoreReadonly = ignoreReadonly;
            return picker;
        };

        picker.options = function (newOptions) {
            if (arguments.length === 0) {
                return $.extend(true, {}, options);
            }

            if (!(newOptions instanceof Object)) {
                throw new TypeError('options() options parameter should be an object');
            }
            $.extend(true, options, newOptions);
            $.each(options, function (key, value) {
                if (picker[key] !== undefined) {
                    picker[key](value);
                } else {
                    throw new TypeError('option ' + key + ' is not recognized!');
                }
            });
            return picker;
        };

        picker.date = function (newDate) {
            ///<signature helpKeyword="$.fn.datetimepicker.date">
            ///<summary>Returns the component's model current date, a moment object or null if not set.</summary>
            ///<returns type="Moment">date.clone()</returns>
            ///</signature>
            ///<signature>
            ///<summary>Sets the components model current moment to it. Passing a null value unsets the components model current moment. Parsing of the newDate parameter is made using moment library with the options.format and options.useStrict components configuration.</summary>
            ///<param name="newDate" locid="$.fn.datetimepicker.date_p:newDate">Takes string, Date, moment, null parameter.</param>
            ///</signature>
            if (arguments.length === 0) {
                if (unset) {
                    return null;
                }
                return date.clone();
            }

            if (newDate !== null && typeof newDate !== 'string' && !moment.isMoment(newDate) && !(newDate instanceof Date)) {
                throw new TypeError('date() parameter must be one of [null, string, moment or Date]');
            }

            setValue(newDate === null ? null : parseInputDate(newDate));
            return picker;
        };

        picker.format = function (newFormat) {
            ///<summary>test su</summary>
            ///<param name="newFormat">info about para</param>
            ///<returns type="string|boolean">returns foo</returns>
            if (arguments.length === 0) {
                return options.format;
            }

            if ((typeof newFormat !== 'string') && ((typeof newFormat !== 'boolean') || (newFormat !== false))) {
                throw new TypeError('format() expects a sting or boolean:false parameter ' + newFormat);
            }

            options.format = newFormat;
            if (actualFormat) {
                initFormatting(); // reinit formatting
            }
            return picker;
        };

        picker.dayViewHeaderFormat = function (newFormat) {
            if (arguments.length === 0) {
                return options.dayViewHeaderFormat;
            }

            if (typeof newFormat !== 'string') {
                throw new TypeError('dayViewHeaderFormat() expects a string parameter');
            }

            options.dayViewHeaderFormat = newFormat;
            return picker;
        };

        picker.extraFormats = function (formats) {
            if (arguments.length === 0) {
                return options.extraFormats;
            }

            if (formats !== false && !(formats instanceof Array)) {
                throw new TypeError('extraFormats() expects an array or false parameter');
            }

            options.extraFormats = formats;
            if (parseFormats) {
                initFormatting(); // reinit formatting
            }
            return picker;
        };

        picker.disabledDates = function (dates) {
            ///<signature helpKeyword="$.fn.datetimepicker.disabledDates">
            ///<summary>Returns an array with the currently set disabled dates on the component.</summary>
            ///<returns type="array">options.disabledDates</returns>
            ///</signature>
            ///<signature>
            ///<summary>Setting this takes precedence over options.minDate, options.maxDate configuration. Also calling this function removes the configuration of
            ///options.enabledDates if such exist.</summary>
            ///<param name="dates" locid="$.fn.datetimepicker.disabledDates_p:dates">Takes an [ string or Date or moment ] of values and allows the user to select only from those days.</param>
            ///</signature>
            if (arguments.length === 0) {
                return (options.disabledDates ? $.extend({}, options.disabledDates) : options.disabledDates);
            }

            if (!dates) {
                options.disabledDates = false;
                update();
                return picker;
            }
            if (!(dates instanceof Array)) {
                throw new TypeError('disabledDates() expects an array parameter');
            }
            options.disabledDates = indexGivenDates(dates);
            options.enabledDates = false;
            update();
            return picker;
        };

        picker.enabledDates = function (dates) {
            ///<signature helpKeyword="$.fn.datetimepicker.enabledDates">
            ///<summary>Returns an array with the currently set enabled dates on the component.</summary>
            ///<returns type="array">options.enabledDates</returns>
            ///</signature>
            ///<signature>
            ///<summary>Setting this takes precedence over options.minDate, options.maxDate configuration. Also calling this function removes the configuration of options.disabledDates if such exist.</summary>
            ///<param name="dates" locid="$.fn.datetimepicker.enabledDates_p:dates">Takes an [ string or Date or moment ] of values and allows the user to select only from those days.</param>
            ///</signature>
            if (arguments.length === 0) {
                return (options.enabledDates ? $.extend({}, options.enabledDates) : options.enabledDates);
            }

            if (!dates) {
                options.enabledDates = false;
                update();
                return picker;
            }
            if (!(dates instanceof Array)) {
                throw new TypeError('enabledDates() expects an array parameter');
            }
            options.enabledDates = indexGivenDates(dates);
            options.disabledDates = false;
            update();
            return picker;
        };

        picker.daysOfWeekDisabled = function (daysOfWeekDisabled) {
            if (arguments.length === 0) {
                return options.daysOfWeekDisabled.splice(0);
            }

            if ((typeof daysOfWeekDisabled === 'boolean') && !daysOfWeekDisabled) {
                options.daysOfWeekDisabled = false;
                update();
                return picker;
            }

            if (!(daysOfWeekDisabled instanceof Array)) {
                throw new TypeError('daysOfWeekDisabled() expects an array parameter');
            }
            options.daysOfWeekDisabled = daysOfWeekDisabled.reduce(function (previousValue, currentValue) {
                currentValue = parseInt(currentValue, 10);
                if (currentValue > 6 || currentValue < 0 || isNaN(currentValue)) {
                    return previousValue;
                }
                if (previousValue.indexOf(currentValue) === -1) {
                    previousValue.push(currentValue);
                }
                return previousValue;
            }, []).sort();
            if (options.useCurrent && !options.keepInvalid) {
                var tries = 0;
                while (!isValid(date, 'd')) {
                    date.add(1, 'd');
                    if (tries === 7) {
                        throw 'Tried 7 times to find a valid date';
                    }
                    tries++;
                }
                setValue(date);
            }
            update();
            return picker;
        };

        picker.maxDate = function (maxDate) {
            if (arguments.length === 0) {
                return options.maxDate ? options.maxDate.clone() : options.maxDate;
            }

            if ((typeof maxDate === 'boolean') && maxDate === false) {
                options.maxDate = false;
                update();
                return picker;
            }

            if (typeof maxDate === 'string') {
                if (maxDate === 'now' || maxDate === 'moment') {
                    maxDate = moment();
                }
            }

            var parsedDate = parseInputDate(maxDate);

            if (!parsedDate.isValid()) {
                throw new TypeError('maxDate() Could not parse date parameter: ' + maxDate);
            }
            if (options.minDate && parsedDate.isBefore(options.minDate)) {
                throw new TypeError('maxDate() date parameter is before options.minDate: ' + parsedDate.format(actualFormat));
            }
            options.maxDate = parsedDate;
            if (options.useCurrent && !options.keepInvalid && date.isAfter(maxDate)) {
                setValue(options.maxDate);
            }
            if (viewDate.isAfter(parsedDate)) {
                viewDate = parsedDate.clone().subtract(options.stepping, 'm');
            }
            update();
            return picker;
        };

        picker.minDate = function (minDate) {
            if (arguments.length === 0) {
                return options.minDate ? options.minDate.clone() : options.minDate;
            }

            if ((typeof minDate === 'boolean') && minDate === false) {
                options.minDate = false;
                update();
                return picker;
            }

            if (typeof minDate === 'string') {
                if (minDate === 'now' || minDate === 'moment') {
                    minDate = moment();
                }
            }

            var parsedDate = parseInputDate(minDate);

            if (!parsedDate.isValid()) {
                throw new TypeError('minDate() Could not parse date parameter: ' + minDate);
            }
            if (options.maxDate && parsedDate.isAfter(options.maxDate)) {
                throw new TypeError('minDate() date parameter is after options.maxDate: ' + parsedDate.format(actualFormat));
            }
            options.minDate = parsedDate;
            if (options.useCurrent && !options.keepInvalid && date.isBefore(minDate)) {
                setValue(options.minDate);
            }
            if (viewDate.isBefore(parsedDate)) {
                viewDate = parsedDate.clone().add(options.stepping, 'm');
            }
            update();
            return picker;
        };

        picker.defaultDate = function (defaultDate) {
            ///<signature helpKeyword="$.fn.datetimepicker.defaultDate">
            ///<summary>Returns a moment with the options.defaultDate option configuration or false if not set</summary>
            ///<returns type="Moment">date.clone()</returns>
            ///</signature>
            ///<signature>
            ///<summary>Will set the picker's inital date. If a boolean:false value is passed the options.defaultDate parameter is cleared.</summary>
            ///<param name="defaultDate" locid="$.fn.datetimepicker.defaultDate_p:defaultDate">Takes a string, Date, moment, boolean:false</param>
            ///</signature>
            if (arguments.length === 0) {
                return options.defaultDate ? options.defaultDate.clone() : options.defaultDate;
            }
            if (!defaultDate) {
                options.defaultDate = false;
                return picker;
            }

            if (typeof defaultDate === 'string') {
                if (defaultDate === 'now' || defaultDate === 'moment') {
                    defaultDate = moment();
                }
            }

            var parsedDate = parseInputDate(defaultDate);
            if (!parsedDate.isValid()) {
                throw new TypeError('defaultDate() Could not parse date parameter: ' + defaultDate);
            }
            if (!isValid(parsedDate)) {
                throw new TypeError('defaultDate() date passed is invalid according to component setup validations');
            }

            options.defaultDate = parsedDate;

            if (options.defaultDate && options.inline || (input.val().trim() === '' && input.attr('placeholder') === undefined)) {
                setValue(options.defaultDate);
            }
            return picker;
        };

        picker.locale = function (locale) {
            if (arguments.length === 0) {
                return options.locale;
            }

            if (!moment.localeData(locale)) {
                throw new TypeError('locale() locale ' + locale + ' is not loaded from moment locales!');
            }

            options.locale = locale;
            date.locale(options.locale);
            viewDate.locale(options.locale);

            if (actualFormat) {
                initFormatting(); // reinit formatting
            }
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.stepping = function (stepping) {
            if (arguments.length === 0) {
                return options.stepping;
            }

            stepping = parseInt(stepping, 10);
            if (isNaN(stepping) || stepping < 1) {
                stepping = 1;
            }
            options.stepping = stepping;
            return picker;
        };

        picker.useCurrent = function (useCurrent) {
            var useCurrentOptions = ['year', 'month', 'day', 'hour', 'minute'];
            if (arguments.length === 0) {
                return options.useCurrent;
            }

            if ((typeof useCurrent !== 'boolean') && (typeof useCurrent !== 'string')) {
                throw new TypeError('useCurrent() expects a boolean or string parameter');
            }
            if (typeof useCurrent === 'string' && useCurrentOptions.indexOf(useCurrent.toLowerCase()) === -1) {
                throw new TypeError('useCurrent() expects a string parameter of ' + useCurrentOptions.join(', '));
            }
            options.useCurrent = useCurrent;
            return picker;
        };

        picker.collapse = function (collapse) {
            if (arguments.length === 0) {
                return options.collapse;
            }

            if (typeof collapse !== 'boolean') {
                throw new TypeError('collapse() expects a boolean parameter');
            }
            if (options.collapse === collapse) {
                return picker;
            }
            options.collapse = collapse;
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.icons = function (icons) {
            if (arguments.length === 0) {
                return $.extend({}, options.icons);
            }

            if (!(icons instanceof Object)) {
                throw new TypeError('icons() expects parameter to be an Object');
            }
            $.extend(options.icons, icons);
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.tooltips = function (tooltips) {
            if (arguments.length === 0) {
                return $.extend({}, options.tooltips);
            }

            if (!(tooltips instanceof Object)) {
                throw new TypeError('tooltips() expects parameter to be an Object');
            }
            $.extend(options.tooltips, tooltips);
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.useStrict = function (useStrict) {
            if (arguments.length === 0) {
                return options.useStrict;
            }

            if (typeof useStrict !== 'boolean') {
                throw new TypeError('useStrict() expects a boolean parameter');
            }
            options.useStrict = useStrict;
            return picker;
        };

        picker.sideBySide = function (sideBySide) {
            if (arguments.length === 0) {
                return options.sideBySide;
            }

            if (typeof sideBySide !== 'boolean') {
                throw new TypeError('sideBySide() expects a boolean parameter');
            }
            options.sideBySide = sideBySide;
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.viewMode = function (viewMode) {
            if (arguments.length === 0) {
                return options.viewMode;
            }

            if (typeof viewMode !== 'string') {
                throw new TypeError('viewMode() expects a string parameter');
            }

            if (viewModes.indexOf(viewMode) === -1) {
                throw new TypeError('viewMode() parameter must be one of (' + viewModes.join(', ') + ') value');
            }

            options.viewMode = viewMode;
            currentViewMode = Math.max(viewModes.indexOf(viewMode), minViewModeNumber);

            showMode();
            return picker;
        };

        picker.toolbarPlacement = function (toolbarPlacement) {
            if (arguments.length === 0) {
                return options.toolbarPlacement;
            }

            if (typeof toolbarPlacement !== 'string') {
                throw new TypeError('toolbarPlacement() expects a string parameter');
            }
            if (toolbarPlacements.indexOf(toolbarPlacement) === -1) {
                throw new TypeError('toolbarPlacement() parameter must be one of (' + toolbarPlacements.join(', ') + ') value');
            }
            options.toolbarPlacement = toolbarPlacement;

            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.widgetPositioning = function (widgetPositioning) {
            if (arguments.length === 0) {
                return $.extend({}, options.widgetPositioning);
            }

            if (({}).toString.call(widgetPositioning) !== '[object Object]') {
                throw new TypeError('widgetPositioning() expects an object variable');
            }
            if (widgetPositioning.horizontal) {
                if (typeof widgetPositioning.horizontal !== 'string') {
                    throw new TypeError('widgetPositioning() horizontal variable must be a string');
                }
                widgetPositioning.horizontal = widgetPositioning.horizontal.toLowerCase();
                if (horizontalModes.indexOf(widgetPositioning.horizontal) === -1) {
                    throw new TypeError('widgetPositioning() expects horizontal parameter to be one of (' + horizontalModes.join(', ') + ')');
                }
                options.widgetPositioning.horizontal = widgetPositioning.horizontal;
            }
            if (widgetPositioning.vertical) {
                if (typeof widgetPositioning.vertical !== 'string') {
                    throw new TypeError('widgetPositioning() vertical variable must be a string');
                }
                widgetPositioning.vertical = widgetPositioning.vertical.toLowerCase();
                if (verticalModes.indexOf(widgetPositioning.vertical) === -1) {
                    throw new TypeError('widgetPositioning() expects vertical parameter to be one of (' + verticalModes.join(', ') + ')');
                }
                options.widgetPositioning.vertical = widgetPositioning.vertical;
            }
            update();
            return picker;
        };

        picker.calendarWeeks = function (calendarWeeks) {
            if (arguments.length === 0) {
                return options.calendarWeeks;
            }

            if (typeof calendarWeeks !== 'boolean') {
                throw new TypeError('calendarWeeks() expects parameter to be a boolean value');
            }

            options.calendarWeeks = calendarWeeks;
            update();
            return picker;
        };

        picker.showTodayButton = function (showTodayButton) {
            if (arguments.length === 0) {
                return options.showTodayButton;
            }

            if (typeof showTodayButton !== 'boolean') {
                throw new TypeError('showTodayButton() expects a boolean parameter');
            }

            options.showTodayButton = showTodayButton;
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.showClear = function (showClear) {
            if (arguments.length === 0) {
                return options.showClear;
            }

            if (typeof showClear !== 'boolean') {
                throw new TypeError('showClear() expects a boolean parameter');
            }

            options.showClear = showClear;
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.widgetParent = function (widgetParent) {
            if (arguments.length === 0) {
                return options.widgetParent;
            }

            if (typeof widgetParent === 'string') {
                widgetParent = $(widgetParent);
            }

            if (widgetParent !== null && (typeof widgetParent !== 'string' && !(widgetParent instanceof $))) {
                throw new TypeError('widgetParent() expects a string or a jQuery object parameter');
            }

            options.widgetParent = widgetParent;
            if (widget) {
                hide();
                show();
            }
            return picker;
        };

        picker.keepOpen = function (keepOpen) {
            if (arguments.length === 0) {
                return options.keepOpen;
            }

            if (typeof keepOpen !== 'boolean') {
                throw new TypeError('keepOpen() expects a boolean parameter');
            }

            options.keepOpen = keepOpen;
            return picker;
        };

        picker.focusOnShow = function (focusOnShow) {
            if (arguments.length === 0) {
                return options.focusOnShow;
            }

            if (typeof focusOnShow !== 'boolean') {
                throw new TypeError('focusOnShow() expects a boolean parameter');
            }

            options.focusOnShow = focusOnShow;
            return picker;
        };

        picker.inline = function (inline) {
            if (arguments.length === 0) {
                return options.inline;
            }

            if (typeof inline !== 'boolean') {
                throw new TypeError('inline() expects a boolean parameter');
            }

            options.inline = inline;
            return picker;
        };

        picker.clear = function () {
            clear();
            return picker;
        };

        picker.keyBinds = function (keyBinds) {
            options.keyBinds = keyBinds;
            return picker;
        };

        picker.debug = function (debug) {
            if (typeof debug !== 'boolean') {
                throw new TypeError('debug() expects a boolean parameter');
            }

            options.debug = debug;
            return picker;
        };

        picker.allowInputToggle = function (allowInputToggle) {
            if (arguments.length === 0) {
                return options.allowInputToggle;
            }

            if (typeof allowInputToggle !== 'boolean') {
                throw new TypeError('allowInputToggle() expects a boolean parameter');
            }

            options.allowInputToggle = allowInputToggle;
            return picker;
        };

        picker.showClose = function (showClose) {
            if (arguments.length === 0) {
                return options.showClose;
            }

            if (typeof showClose !== 'boolean') {
                throw new TypeError('showClose() expects a boolean parameter');
            }

            options.showClose = showClose;
            return picker;
        };

        picker.keepInvalid = function (keepInvalid) {
            if (arguments.length === 0) {
                return options.keepInvalid;
            }

            if (typeof keepInvalid !== 'boolean') {
                throw new TypeError('keepInvalid() expects a boolean parameter');
            }
            options.keepInvalid = keepInvalid;
            return picker;
        };

        picker.datepickerInput = function (datepickerInput) {
            if (arguments.length === 0) {
                return options.datepickerInput;
            }

            if (typeof datepickerInput !== 'string') {
                throw new TypeError('datepickerInput() expects a string parameter');
            }

            options.datepickerInput = datepickerInput;
            return picker;
        };

        picker.parseInputDate = function (parseInputDate) {
            if (arguments.length === 0) {
                return options.parseInputDate;
            }

            if (typeof parseInputDate !== 'function') {
                throw new TypeError('parseInputDate() sholud be as function');
            }

            options.parseInputDate = parseInputDate;

            return picker;
        };

        picker.disabledTimeIntervals = function (disabledTimeIntervals) {
            ///<signature helpKeyword="$.fn.datetimepicker.disabledTimeIntervals">
            ///<summary>Returns an array with the currently set disabled dates on the component.</summary>
            ///<returns type="array">options.disabledTimeIntervals</returns>
            ///</signature>
            ///<signature>
            ///<summary>Setting this takes precedence over options.minDate, options.maxDate configuration. Also calling this function removes the configuration of
            ///options.enabledDates if such exist.</summary>
            ///<param name="dates" locid="$.fn.datetimepicker.disabledTimeIntervals_p:dates">Takes an [ string or Date or moment ] of values and allows the user to select only from those days.</param>
            ///</signature>
            if (arguments.length === 0) {
                return (options.disabledTimeIntervals ? $.extend({}, options.disabledTimeIntervals) : options.disabledTimeIntervals);
            }

            if (!disabledTimeIntervals) {
                options.disabledTimeIntervals = false;
                update();
                return picker;
            }
            if (!(disabledTimeIntervals instanceof Array)) {
                throw new TypeError('disabledTimeIntervals() expects an array parameter');
            }
            options.disabledTimeIntervals = disabledTimeIntervals;
            update();
            return picker;
        };

        picker.disabledHours = function (hours) {
            ///<signature helpKeyword="$.fn.datetimepicker.disabledHours">
            ///<summary>Returns an array with the currently set disabled hours on the component.</summary>
            ///<returns type="array">options.disabledHours</returns>
            ///</signature>
            ///<signature>
            ///<summary>Setting this takes precedence over options.minDate, options.maxDate configuration. Also calling this function removes the configuration of
            ///options.enabledHours if such exist.</summary>
            ///<param name="hours" locid="$.fn.datetimepicker.disabledHours_p:hours">Takes an [ int ] of values and disallows the user to select only from those hours.</param>
            ///</signature>
            if (arguments.length === 0) {
                return (options.disabledHours ? $.extend({}, options.disabledHours) : options.disabledHours);
            }

            if (!hours) {
                options.disabledHours = false;
                update();
                return picker;
            }
            if (!(hours instanceof Array)) {
                throw new TypeError('disabledHours() expects an array parameter');
            }
            options.disabledHours = indexGivenHours(hours);
            options.enabledHours = false;
            if (options.useCurrent && !options.keepInvalid) {
                var tries = 0;
                while (!isValid(date, 'h')) {
                    date.add(1, 'h');
                    if (tries === 24) {
                        throw 'Tried 24 times to find a valid date';
                    }
                    tries++;
                }
                setValue(date);
            }
            update();
            return picker;
        };

        picker.enabledHours = function (hours) {
            ///<signature helpKeyword="$.fn.datetimepicker.enabledHours">
            ///<summary>Returns an array with the currently set enabled hours on the component.</summary>
            ///<returns type="array">options.enabledHours</returns>
            ///</signature>
            ///<signature>
            ///<summary>Setting this takes precedence over options.minDate, options.maxDate configuration. Also calling this function removes the configuration of options.disabledHours if such exist.</summary>
            ///<param name="hours" locid="$.fn.datetimepicker.enabledHours_p:hours">Takes an [ int ] of values and allows the user to select only from those hours.</param>
            ///</signature>
            if (arguments.length === 0) {
                return (options.enabledHours ? $.extend({}, options.enabledHours) : options.enabledHours);
            }

            if (!hours) {
                options.enabledHours = false;
                update();
                return picker;
            }
            if (!(hours instanceof Array)) {
                throw new TypeError('enabledHours() expects an array parameter');
            }
            options.enabledHours = indexGivenHours(hours);
            options.disabledHours = false;
            if (options.useCurrent && !options.keepInvalid) {
                var tries = 0;
                while (!isValid(date, 'h')) {
                    date.add(1, 'h');
                    if (tries === 24) {
                        throw 'Tried 24 times to find a valid date';
                    }
                    tries++;
                }
                setValue(date);
            }
            update();
            return picker;
        };

        picker.viewDate = function (newDate) {
            ///<signature helpKeyword="$.fn.datetimepicker.viewDate">
            ///<summary>Returns the component's model current viewDate, a moment object or null if not set.</summary>
            ///<returns type="Moment">viewDate.clone()</returns>
            ///</signature>
            ///<signature>
            ///<summary>Sets the components model current moment to it. Passing a null value unsets the components model current moment. Parsing of the newDate parameter is made using moment library with the options.format and options.useStrict components configuration.</summary>
            ///<param name="newDate" locid="$.fn.datetimepicker.date_p:newDate">Takes string, viewDate, moment, null parameter.</param>
            ///</signature>
            if (arguments.length === 0) {
                return viewDate.clone();
            }

            if (!newDate) {
                viewDate = date.clone();
                return picker;
            }

            if (typeof newDate !== 'string' && !moment.isMoment(newDate) && !(newDate instanceof Date)) {
                throw new TypeError('viewDate() parameter must be one of [string, moment or Date]');
            }

            viewDate = parseInputDate(newDate);
            viewUpdate();
            return picker;
        };

        // initializing element and component attributes
        if (element.is('input')) {
            input = element;
        } else {
            input = element.find(options.datepickerInput);
            if (input.size() === 0) {
                input = element.find('input');
            } else if (!input.is('input')) {
                throw new Error('CSS class "' + options.datepickerInput + '" cannot be applied to non input element');
            }
        }

        if (element.hasClass('input-group')) {
            // in case there is more then one 'input-group-addon' Issue #48
            if (element.find('.datepickerbutton').size() === 0) {
                component = element.find('.input-group-addon');
            } else {
                component = element.find('.datepickerbutton');
            }
        }

        if (!options.inline && !input.is('input')) {
            throw new Error('Could not initialize DateTimePicker without an input element');
        }

        $.extend(true, options, dataToOptions());

        picker.options(options);

        initFormatting();

        attachDatePickerElementEvents();

        if (input.prop('disabled')) {
            picker.disable();
        }
        if (input.is('input') && input.val().trim().length !== 0) {
            setValue(parseInputDate(input.val().trim()));
        }
        else if (options.defaultDate && input.attr('placeholder') === undefined) {
            setValue(options.defaultDate);
        }
        if (options.inline) {
            show();
        }
        return picker;
    };

    /********************************************************************************
     *
     * jQuery plugin constructor and defaults object
     *
     ********************************************************************************/

    $.fn.datetimepicker = function (options) {
        return this.each(function () {
            var $this = $(this);
            if (!$this.data('DateTimePicker')) {
                // create a private copy of the defaults object
                options = $.extend(true, {}, $.fn.datetimepicker.defaults, options);
                $this.data('DateTimePicker', dateTimePicker($this, options));
            }
        });
    };

    $.fn.datetimepicker.defaults = {
        format: false,
        dayViewHeaderFormat: 'MMMM YYYY',
        extraFormats: false,
        stepping: 1,
        minDate: false,
        maxDate: false,
        useCurrent: true,
        collapse: true,
        locale: moment.locale(),
        defaultDate: false,
        disabledDates: false,
        enabledDates: false,
        icons: {
            time: 'glyphicon glyphicon-time',
            date: 'glyphicon glyphicon-calendar',
            up: 'glyphicon glyphicon-chevron-up',
            down: 'glyphicon glyphicon-chevron-down',
            previous: 'glyphicon glyphicon-chevron-left',
            next: 'glyphicon glyphicon-chevron-right',
            today: 'glyphicon glyphicon-screenshot',
            clear: 'glyphicon glyphicon-trash',
            close: 'glyphicon glyphicon-remove'
        },
        tooltips: {
            today: 'Go to today',
            clear: 'Clear selection',
            close: 'Close the picker',
            selectMonth: 'Select Month',
            prevMonth: 'Previous Month',
            nextMonth: 'Next Month',
            selectYear: 'Select Year',
            prevYear: 'Previous Year',
            nextYear: 'Next Year',
            selectDecade: 'Select Decade',
            prevDecade: 'Previous Decade',
            nextDecade: 'Next Decade',
            prevCentury: 'Previous Century',
            nextCentury: 'Next Century'
        },
        useStrict: false,
        sideBySide: false,
        daysOfWeekDisabled: false,
        calendarWeeks: false,
        viewMode: 'days',
        toolbarPlacement: 'default',
        showTodayButton: false,
        showClear: false,
        showClose: false,
        widgetPositioning: {
            horizontal: 'auto',
            vertical: 'auto'
        },
        widgetParent: null,
        ignoreReadonly: false,
        keepOpen: false,
        focusOnShow: true,
        inline: false,
        keepInvalid: false,
        datepickerInput: '.datepickerinput',
        keyBinds: {
            up: function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().subtract(7, 'd'));
                } else {
                    this.date(d.clone().add(this.stepping(), 'm'));
                }
            },
            down: function (widget) {
                if (!widget) {
                    this.show();
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().add(7, 'd'));
                } else {
                    this.date(d.clone().subtract(this.stepping(), 'm'));
                }
            },
            'control up': function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().subtract(1, 'y'));
                } else {
                    this.date(d.clone().add(1, 'h'));
                }
            },
            'control down': function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().add(1, 'y'));
                } else {
                    this.date(d.clone().subtract(1, 'h'));
                }
            },
            left: function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().subtract(1, 'd'));
                }
            },
            right: function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().add(1, 'd'));
                }
            },
            pageUp: function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().subtract(1, 'M'));
                }
            },
            pageDown: function (widget) {
                if (!widget) {
                    return;
                }
                var d = this.date() || moment();
                if (widget.find('.datepicker').is(':visible')) {
                    this.date(d.clone().add(1, 'M'));
                }
            },
            enter: function () {
                this.hide();
            },
            escape: function () {
                this.hide();
            },
            //tab: function (widget) { //this break the flow of the form. disabling for now
            //    var toggle = widget.find('.picker-switch a[data-action="togglePicker"]');
            //    if(toggle.length > 0) toggle.click();
            //},
            'control space': function (widget) {
                if (widget.find('.timepicker').is(':visible')) {
                    widget.find('.btn[data-action="togglePeriod"]').click();
                }
            },
            t: function () {
                this.date(moment());
            },
            'delete': function () {
                this.clear();
            }
        },
        debug: false,
        allowInputToggle: false,
        disabledTimeIntervals: false,
        disabledHours: false,
        enabledHours: false,
        viewDate: false
    };
}));

/*!
 * Select2 4.0.1
 * https://select2.github.io
 *
 * Released under the MIT license
 * https://github.com/select2/select2/blob/master/LICENSE.md
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('jquery'));
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function (jQuery) {
    // This is needed so we can catch the AMD loader configuration and use it
    // The inner file should be wrapped (by `banner.start.js`) in a function that
    // returns the AMD loader references.
    var S2 =
  (function () {
      // Restore the Select2 AMD loader so it can be used
      // Needed mostly in the language files, where the loader is not inserted
      if (jQuery && jQuery.fn && jQuery.fn.select2 && jQuery.fn.select2.amd) {
          var S2 = jQuery.fn.select2.amd;
      }
      var S2; (function () {
          if (!S2 || !S2.requirejs) {
              if (!S2) { S2 = {}; } else { require = S2; }
              /**
               * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
               * Available via the MIT or new BSD license.
               * see: http://github.com/jrburke/almond for details
               */
              //Going sloppy to avoid 'use strict' string cost, but strict practices should
              //be followed.
              /*jslint sloppy: true */
              /*global setTimeout: false */

              var requirejs, require, define;
              (function (undef) {
                  var main, req, makeMap, handlers,
                      defined = {},
                      waiting = {},
                      config = {},
                      defining = {},
                      hasOwn = Object.prototype.hasOwnProperty,
                      aps = [].slice,
                      jsSuffixRegExp = /\.js$/;

                  function hasProp(obj, prop) {
                      return hasOwn.call(obj, prop);
                  }

                  /**
                   * Given a relative module name, like ./something, normalize it to
                   * a real name that can be mapped to a path.
                   * @param {String} name the relative name
                   * @param {String} baseName a real name that the name arg is relative
                   * to.
                   * @returns {String} normalized name
                   */
                  function normalize(name, baseName) {
                      var nameParts, nameSegment, mapValue, foundMap, lastIndex,
                          foundI, foundStarMap, starI, i, j, part,
                          baseParts = baseName && baseName.split("/"),
                          map = config.map,
                          starMap = (map && map['*']) || {};

                      //Adjust any relative paths.
                      if (name && name.charAt(0) === ".") {
                          //If have a base name, try to normalize against it,
                          //otherwise, assume it is a top-level require that will
                          //be relative to baseUrl in the end.
                          if (baseName) {
                              name = name.split('/');
                              lastIndex = name.length - 1;

                              // Node .js allowance:
                              if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                                  name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                              }

                              //Lop off the last part of baseParts, so that . matches the
                              //"directory" and not name of the baseName's module. For instance,
                              //baseName of "one/two/three", maps to "one/two/three.js", but we
                              //want the directory, "one/two" for this normalization.
                              name = baseParts.slice(0, baseParts.length - 1).concat(name);

                              //start trimDots
                              for (i = 0; i < name.length; i += 1) {
                                  part = name[i];
                                  if (part === ".") {
                                      name.splice(i, 1);
                                      i -= 1;
                                  } else if (part === "..") {
                                      if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                                          //End of the line. Keep at least one non-dot
                                          //path segment at the front so it can be mapped
                                          //correctly to disk. Otherwise, there is likely
                                          //no path mapping for a path starting with '..'.
                                          //This can still fail, but catches the most reasonable
                                          //uses of ..
                                          break;
                                      } else if (i > 0) {
                                          name.splice(i - 1, 2);
                                          i -= 2;
                                      }
                                  }
                              }
                              //end trimDots

                              name = name.join("/");
                          } else if (name.indexOf('./') === 0) {
                              // No baseName, so this is ID is resolved relative
                              // to baseUrl, pull off the leading dot.
                              name = name.substring(2);
                          }
                      }

                      //Apply map config if available.
                      if ((baseParts || starMap) && map) {
                          nameParts = name.split('/');

                          for (i = nameParts.length; i > 0; i -= 1) {
                              nameSegment = nameParts.slice(0, i).join("/");

                              if (baseParts) {
                                  //Find the longest baseName segment match in the config.
                                  //So, do joins on the biggest to smallest lengths of baseParts.
                                  for (j = baseParts.length; j > 0; j -= 1) {
                                      mapValue = map[baseParts.slice(0, j).join('/')];

                                      //baseName segment has  config, find if it has one for
                                      //this name.
                                      if (mapValue) {
                                          mapValue = mapValue[nameSegment];
                                          if (mapValue) {
                                              //Match, update name to the new value.
                                              foundMap = mapValue;
                                              foundI = i;
                                              break;
                                          }
                                      }
                                  }
                              }

                              if (foundMap) {
                                  break;
                              }

                              //Check for a star map match, but just hold on to it,
                              //if there is a shorter segment match later in a matching
                              //config, then favor over this star map.
                              if (!foundStarMap && starMap && starMap[nameSegment]) {
                                  foundStarMap = starMap[nameSegment];
                                  starI = i;
                              }
                          }

                          if (!foundMap && foundStarMap) {
                              foundMap = foundStarMap;
                              foundI = starI;
                          }

                          if (foundMap) {
                              nameParts.splice(0, foundI, foundMap);
                              name = nameParts.join('/');
                          }
                      }

                      return name;
                  }

                  function makeRequire(relName, forceSync) {
                      return function () {
                          //A version of a require function that passes a moduleName
                          //value for items that may need to
                          //look up paths relative to the moduleName
                          var args = aps.call(arguments, 0);

                          //If first arg is not require('string'), and there is only
                          //one arg, it is the array form without a callback. Insert
                          //a null so that the following concat is correct.
                          if (typeof args[0] !== 'string' && args.length === 1) {
                              args.push(null);
                          }
                          return req.apply(undef, args.concat([relName, forceSync]));
                      };
                  }

                  function makeNormalize(relName) {
                      return function (name) {
                          return normalize(name, relName);
                      };
                  }

                  function makeLoad(depName) {
                      return function (value) {
                          defined[depName] = value;
                      };
                  }

                  function callDep(name) {
                      if (hasProp(waiting, name)) {
                          var args = waiting[name];
                          delete waiting[name];
                          defining[name] = true;
                          main.apply(undef, args);
                      }

                      if (!hasProp(defined, name) && !hasProp(defining, name)) {
                          throw new Error('No ' + name);
                      }
                      return defined[name];
                  }

                  //Turns a plugin!resource to [plugin, resource]
                  //with the plugin being undefined if the name
                  //did not have a plugin prefix.
                  function splitPrefix(name) {
                      var prefix,
                          index = name ? name.indexOf('!') : -1;
                      if (index > -1) {
                          prefix = name.substring(0, index);
                          name = name.substring(index + 1, name.length);
                      }
                      return [prefix, name];
                  }

                  /**
                   * Makes a name map, normalizing the name, and using a plugin
                   * for normalization if necessary. Grabs a ref to plugin
                   * too, as an optimization.
                   */
                  makeMap = function (name, relName) {
                      var plugin,
                          parts = splitPrefix(name),
                          prefix = parts[0];

                      name = parts[1];

                      if (prefix) {
                          prefix = normalize(prefix, relName);
                          plugin = callDep(prefix);
                      }

                      //Normalize according
                      if (prefix) {
                          if (plugin && plugin.normalize) {
                              name = plugin.normalize(name, makeNormalize(relName));
                          } else {
                              name = normalize(name, relName);
                          }
                      } else {
                          name = normalize(name, relName);
                          parts = splitPrefix(name);
                          prefix = parts[0];
                          name = parts[1];
                          if (prefix) {
                              plugin = callDep(prefix);
                          }
                      }

                      //Using ridiculous property names for space reasons
                      return {
                          f: prefix ? prefix + '!' + name : name, //fullName
                          n: name,
                          pr: prefix,
                          p: plugin
                      };
                  };

                  function makeConfig(name) {
                      return function () {
                          return (config && config.config && config.config[name]) || {};
                      };
                  }

                  handlers = {
                      require: function (name) {
                          return makeRequire(name);
                      },
                      exports: function (name) {
                          var e = defined[name];
                          if (typeof e !== 'undefined') {
                              return e;
                          } else {
                              return (defined[name] = {});
                          }
                      },
                      module: function (name) {
                          return {
                              id: name,
                              uri: '',
                              exports: defined[name],
                              config: makeConfig(name)
                          };
                      }
                  };

                  main = function (name, deps, callback, relName) {
                      var cjsModule, depName, ret, map, i,
                          args = [],
                          callbackType = typeof callback,
                          usingExports;

                      //Use name if no relName
                      relName = relName || name;

                      //Call the callback to define the module, if necessary.
                      if (callbackType === 'undefined' || callbackType === 'function') {
                          //Pull out the defined dependencies and pass the ordered
                          //values to the callback.
                          //Default to [require, exports, module] if no deps
                          deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
                          for (i = 0; i < deps.length; i += 1) {
                              map = makeMap(deps[i], relName);
                              depName = map.f;

                              //Fast path CommonJS standard dependencies.
                              if (depName === "require") {
                                  args[i] = handlers.require(name);
                              } else if (depName === "exports") {
                                  //CommonJS module spec 1.1
                                  args[i] = handlers.exports(name);
                                  usingExports = true;
                              } else if (depName === "module") {
                                  //CommonJS module spec 1.1
                                  cjsModule = args[i] = handlers.module(name);
                              } else if (hasProp(defined, depName) ||
                                         hasProp(waiting, depName) ||
                                         hasProp(defining, depName)) {
                                  args[i] = callDep(depName);
                              } else if (map.p) {
                                  map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                                  args[i] = defined[depName];
                              } else {
                                  throw new Error(name + ' missing ' + depName);
                              }
                          }

                          ret = callback ? callback.apply(defined[name], args) : undefined;

                          if (name) {
                              //If setting exports via "module" is in play,
                              //favor that over return value and exports. After that,
                              //favor a non-undefined return value over exports use.
                              if (cjsModule && cjsModule.exports !== undef &&
                                      cjsModule.exports !== defined[name]) {
                                  defined[name] = cjsModule.exports;
                              } else if (ret !== undef || !usingExports) {
                                  //Use the return value from the function.
                                  defined[name] = ret;
                              }
                          }
                      } else if (name) {
                          //May just be an object definition for the module. Only
                          //worry about defining if have a module name.
                          defined[name] = callback;
                      }
                  };

                  requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
                      if (typeof deps === "string") {
                          if (handlers[deps]) {
                              //callback in this case is really relName
                              return handlers[deps](callback);
                          }
                          //Just return the module wanted. In this scenario, the
                          //deps arg is the module name, and second arg (if passed)
                          //is just the relName.
                          //Normalize module name, if it contains . or ..
                          return callDep(makeMap(deps, callback).f);
                      } else if (!deps.splice) {
                          //deps is a config object, not an array.
                          config = deps;
                          if (config.deps) {
                              req(config.deps, config.callback);
                          }
                          if (!callback) {
                              return;
                          }

                          if (callback.splice) {
                              //callback is an array, which means it is a dependency list.
                              //Adjust args if there are dependencies
                              deps = callback;
                              callback = relName;
                              relName = null;
                          } else {
                              deps = undef;
                          }
                      }

                      //Support require(['a'])
                      callback = callback || function () { };

                      //If relName is a function, it is an errback handler,
                      //so remove it.
                      if (typeof relName === 'function') {
                          relName = forceSync;
                          forceSync = alt;
                      }

                      //Simulate async callback;
                      if (forceSync) {
                          main(undef, deps, callback, relName);
                      } else {
                          //Using a non-zero value because of concern for what old browsers
                          //do, and latest browsers "upgrade" to 4 if lower value is used:
                          //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
                          //If want a value immediately, use require('id') instead -- something
                          //that works in almond on the global level, but not guaranteed and
                          //unlikely to work in other AMD implementations.
                          setTimeout(function () {
                              main(undef, deps, callback, relName);
                          }, 4);
                      }

                      return req;
                  };

                  /**
                   * Just drops the config on the floor, but returns req in case
                   * the config return value is used.
                   */
                  req.config = function (cfg) {
                      return req(cfg);
                  };

                  /**
                   * Expose module registry for debugging and tooling
                   */
                  requirejs._defined = defined;

                  define = function (name, deps, callback) {
                      if (typeof name !== 'string') {
                          throw new Error('See almond README: incorrect module build, no module name');
                      }

                      //This module may not have dependencies
                      if (!deps.splice) {
                          //deps is not an array, so probably means
                          //an object literal or factory function for
                          //the value. Adjust args.
                          callback = deps;
                          deps = [];
                      }

                      if (!hasProp(defined, name) && !hasProp(waiting, name)) {
                          waiting[name] = [name, deps, callback];
                      }
                  };

                  define.amd = {
                      jQuery: true
                  };
              }());

              S2.requirejs = requirejs; S2.require = require; S2.define = define;
          }
      }());
      S2.define("almond", function () { });

      /* global jQuery:false, $:false */
      S2.define('jquery', [], function () {
          var _$ = jQuery || $;

          if (_$ == null && console && console.error) {
              console.error(
                'Select2: An instance of jQuery or a jQuery-compatible library was not ' +
                'found. Make sure that you are including jQuery before Select2 on your ' +
                'web page.'
              );
          }

          return _$;
      });

      S2.define('select2/utils', [
        'jquery'
      ], function ($) {
          var Utils = {};

          Utils.Extend = function (ChildClass, SuperClass) {
              var __hasProp = {}.hasOwnProperty;

              function BaseConstructor() {
                  this.constructor = ChildClass;
              }

              for (var key in SuperClass) {
                  if (__hasProp.call(SuperClass, key)) {
                      ChildClass[key] = SuperClass[key];
                  }
              }

              BaseConstructor.prototype = SuperClass.prototype;
              ChildClass.prototype = new BaseConstructor();
              ChildClass.__super__ = SuperClass.prototype;

              return ChildClass;
          };

          function getMethods(theClass) {
              var proto = theClass.prototype;

              var methods = [];

              for (var methodName in proto) {
                  var m = proto[methodName];

                  if (typeof m !== 'function') {
                      continue;
                  }

                  if (methodName === 'constructor') {
                      continue;
                  }

                  methods.push(methodName);
              }

              return methods;
          }

          Utils.Decorate = function (SuperClass, DecoratorClass) {
              var decoratedMethods = getMethods(DecoratorClass);
              var superMethods = getMethods(SuperClass);

              function DecoratedClass() {
                  var unshift = Array.prototype.unshift;

                  var argCount = DecoratorClass.prototype.constructor.length;

                  var calledConstructor = SuperClass.prototype.constructor;

                  if (argCount > 0) {
                      unshift.call(arguments, SuperClass.prototype.constructor);

                      calledConstructor = DecoratorClass.prototype.constructor;
                  }

                  calledConstructor.apply(this, arguments);
              }

              DecoratorClass.displayName = SuperClass.displayName;

              function ctr() {
                  this.constructor = DecoratedClass;
              }

              DecoratedClass.prototype = new ctr();

              for (var m = 0; m < superMethods.length; m++) {
                  var superMethod = superMethods[m];

                  DecoratedClass.prototype[superMethod] =
                    SuperClass.prototype[superMethod];
              }

              var calledMethod = function (methodName) {
                  // Stub out the original method if it's not decorating an actual method
                  var originalMethod = function () { };

                  if (methodName in DecoratedClass.prototype) {
                      originalMethod = DecoratedClass.prototype[methodName];
                  }

                  var decoratedMethod = DecoratorClass.prototype[methodName];

                  return function () {
                      var unshift = Array.prototype.unshift;

                      unshift.call(arguments, originalMethod);

                      return decoratedMethod.apply(this, arguments);
                  };
              };

              for (var d = 0; d < decoratedMethods.length; d++) {
                  var decoratedMethod = decoratedMethods[d];

                  DecoratedClass.prototype[decoratedMethod] = calledMethod(decoratedMethod);
              }

              return DecoratedClass;
          };

          var Observable = function () {
              this.listeners = {};
          };

          Observable.prototype.on = function (event, callback) {
              this.listeners = this.listeners || {};

              if (event in this.listeners) {
                  this.listeners[event].push(callback);
              } else {
                  this.listeners[event] = [callback];
              }
          };

          Observable.prototype.trigger = function (event) {
              var slice = Array.prototype.slice;

              this.listeners = this.listeners || {};

              if (event in this.listeners) {
                  this.invoke(this.listeners[event], slice.call(arguments, 1));
              }

              if ('*' in this.listeners) {
                  this.invoke(this.listeners['*'], arguments);
              }
          };

          Observable.prototype.invoke = function (listeners, params) {
              for (var i = 0, len = listeners.length; i < len; i++) {
                  listeners[i].apply(this, params);
              }
          };

          Utils.Observable = Observable;

          Utils.generateChars = function (length) {
              var chars = '';

              for (var i = 0; i < length; i++) {
                  var randomChar = Math.floor(Math.random() * 36);
                  chars += randomChar.toString(36);
              }

              return chars;
          };

          Utils.bind = function (func, context) {
              return function () {
                  func.apply(context, arguments);
              };
          };

          Utils._convertData = function (data) {
              for (var originalKey in data) {
                  var keys = originalKey.split('-');

                  var dataLevel = data;

                  if (keys.length === 1) {
                      continue;
                  }

                  for (var k = 0; k < keys.length; k++) {
                      var key = keys[k];

                      // Lowercase the first letter
                      // By default, dash-separated becomes camelCase
                      key = key.substring(0, 1).toLowerCase() + key.substring(1);

                      if (!(key in dataLevel)) {
                          dataLevel[key] = {};
                      }

                      if (k == keys.length - 1) {
                          dataLevel[key] = data[originalKey];
                      }

                      dataLevel = dataLevel[key];
                  }

                  delete data[originalKey];
              }

              return data;
          };

          Utils.hasScroll = function (index, el) {
              // Adapted from the function created by @ShadowScripter
              // and adapted by @BillBarry on the Stack Exchange Code Review website.
              // The original code can be found at
              // http://codereview.stackexchange.com/q/13338
              // and was designed to be used with the Sizzle selector engine.

              var $el = $(el);
              var overflowX = el.style.overflowX;
              var overflowY = el.style.overflowY;

              //Check both x and y declarations
              if (overflowX === overflowY &&
                  (overflowY === 'hidden' || overflowY === 'visible')) {
                  return false;
              }

              if (overflowX === 'scroll' || overflowY === 'scroll') {
                  return true;
              }

              return ($el.innerHeight() < el.scrollHeight ||
                $el.innerWidth() < el.scrollWidth);
          };

          Utils.escapeMarkup = function (markup) {
              var replaceMap = {
                  '\\': '&#92;',
                  '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  '"': '&quot;',
                  '\'': '&#39;',
                  '/': '&#47;'
              };

              // Do not try to escape the markup if it's not a string
              if (typeof markup !== 'string') {
                  return markup;
              }

              return String(markup).replace(/[&<>"'\/\\]/g, function (match) {
                  return replaceMap[match];
              });
          };

          // Append an array of jQuery nodes to a given element.
          Utils.appendMany = function ($element, $nodes) {
              // jQuery 1.7.x does not support $.fn.append() with an array
              // Fall back to a jQuery object collection using $.fn.add()
              if ($.fn.jquery.substr(0, 3) === '1.7') {
                  var $jqNodes = $();

                  $.map($nodes, function (node) {
                      $jqNodes = $jqNodes.add(node);
                  });

                  $nodes = $jqNodes;
              }

              $element.append($nodes);
          };

          return Utils;
      });

      S2.define('select2/results', [
        'jquery',
        './utils'
      ], function ($, Utils) {
          function Results($element, options, dataAdapter) {
              this.$element = $element;
              this.data = dataAdapter;
              this.options = options;

              Results.__super__.constructor.call(this);
          }

          Utils.Extend(Results, Utils.Observable);

          Results.prototype.render = function () {
              var $results = $(
                '<ul class="select2-results__options" role="tree"></ul>'
              );

              if (this.options.get('multiple')) {
                  $results.attr('aria-multiselectable', 'true');
              }

              this.$results = $results;

              return $results;
          };

          Results.prototype.clear = function () {
              this.$results.empty();
          };

          Results.prototype.displayMessage = function (params) {
              var escapeMarkup = this.options.get('escapeMarkup');

              this.clear();
              this.hideLoading();

              var $message = $(
                '<li role="treeitem" aria-live="assertive"' +
                ' class="select2-results__option"></li>'
              );

              var message = this.options.get('translations').get(params.message);

              $message.append(
                escapeMarkup(
                  message(params.args)
                )
              );

              $message[0].className += ' select2-results__message';

              this.$results.append($message);
          };

          Results.prototype.hideMessages = function () {
              this.$results.find('.select2-results__message').remove();
          };

          Results.prototype.append = function (data) {
              this.hideLoading();

              var $options = [];

              if (data.results == null || data.results.length === 0) {
                  if (this.$results.children().length === 0) {
                      this.trigger('results:message', {
                          message: 'noResults'
                      });
                  }

                  return;
              }

              data.results = this.sort(data.results);

              for (var d = 0; d < data.results.length; d++) {
                  var item = data.results[d];

                  var $option = this.option(item);

                  $options.push($option);
              }

              this.$results.append($options);
          };

          Results.prototype.position = function ($results, $dropdown) {
              var $resultsContainer = $dropdown.find('.select2-results');
              $resultsContainer.append($results);
          };

          Results.prototype.sort = function (data) {
              var sorter = this.options.get('sorter');

              return sorter(data);
          };

          Results.prototype.setClasses = function () {
              var self = this;

              this.data.current(function (selected) {
                  var selectedIds = $.map(selected, function (s) {
                      return s.id.toString();
                  });

                  var $options = self.$results
                    .find('.select2-results__option[aria-selected]');

                  $options.each(function () {
                      var $option = $(this);

                      var item = $.data(this, 'data');

                      // id needs to be converted to a string when comparing
                      var id = '' + item.id;

                      if ((item.element != null && item.element.selected) ||
                          (item.element == null && $.inArray(id, selectedIds) > -1)) {
                          $option.attr('aria-selected', 'true');
                      } else {
                          $option.attr('aria-selected', 'false');
                      }
                  });

                  var $selected = $options.filter('[aria-selected=true]');

                  // Check if there are any selected options
                  if ($selected.length > 0) {
                      // If there are selected options, highlight the first
                      $selected.first().trigger('mouseenter');
                  } else {
                      // If there are no selected options, highlight the first option
                      // in the dropdown
                      $options.first().trigger('mouseenter');
                  }
              });
          };

          Results.prototype.showLoading = function (params) {
              this.hideLoading();

              var loadingMore = this.options.get('translations').get('searching');

              var loading = {
                  disabled: true,
                  loading: true,
                  text: loadingMore(params)
              };
              var $loading = this.option(loading);
              $loading.className += ' loading-results';

              this.$results.prepend($loading);
          };

          Results.prototype.hideLoading = function () {
              this.$results.find('.loading-results').remove();
          };

          Results.prototype.option = function (data) {
              var option = document.createElement('li');
              option.className = 'select2-results__option';

              var attrs = {
                  'role': 'treeitem',
                  'aria-selected': 'false'
              };

              if (data.disabled) {
                  delete attrs['aria-selected'];
                  attrs['aria-disabled'] = 'true';
              }

              if (data.id == null) {
                  delete attrs['aria-selected'];
              }

              if (data._resultId != null) {
                  option.id = data._resultId;
              }

              if (data.title) {
                  option.title = data.title;
              }

              if (data.children) {
                  attrs.role = 'group';
                  attrs['aria-label'] = data.text;
                  delete attrs['aria-selected'];
              }

              for (var attr in attrs) {
                  var val = attrs[attr];

                  option.setAttribute(attr, val);
              }

              if (data.children) {
                  var $option = $(option);

                  var label = document.createElement('strong');
                  label.className = 'select2-results__group';

                  var $label = $(label);
                  this.template(data, label);

                  var $children = [];

                  for (var c = 0; c < data.children.length; c++) {
                      var child = data.children[c];

                      var $child = this.option(child);

                      $children.push($child);
                  }

                  var $childrenContainer = $('<ul></ul>', {
                      'class': 'select2-results__options select2-results__options--nested'
                  });

                  $childrenContainer.append($children);

                  $option.append(label);
                  $option.append($childrenContainer);
              } else {
                  this.template(data, option);
              }

              $.data(option, 'data', data);

              return option;
          };

          Results.prototype.bind = function (container, $container) {
              var self = this;

              var id = container.id + '-results';

              this.$results.attr('id', id);

              container.on('results:all', function (params) {
                  self.clear();
                  self.append(params.data);

                  if (container.isOpen()) {
                      self.setClasses();
                  }
              });

              container.on('results:append', function (params) {
                  self.append(params.data);

                  if (container.isOpen()) {
                      self.setClasses();
                  }
              });

              container.on('query', function (params) {
                  self.hideMessages();
                  self.showLoading(params);
              });

              container.on('select', function () {
                  if (!container.isOpen()) {
                      return;
                  }

                  self.setClasses();
              });

              container.on('unselect', function () {
                  if (!container.isOpen()) {
                      return;
                  }

                  self.setClasses();
              });

              container.on('open', function () {
                  // When the dropdown is open, aria-expended="true"
                  self.$results.attr('aria-expanded', 'true');
                  self.$results.attr('aria-hidden', 'false');

                  self.setClasses();
                  self.ensureHighlightVisible();
              });

              container.on('close', function () {
                  // When the dropdown is closed, aria-expended="false"
                  self.$results.attr('aria-expanded', 'false');
                  self.$results.attr('aria-hidden', 'true');
                  self.$results.removeAttr('aria-activedescendant');
              });

              container.on('results:toggle', function () {
                  var $highlighted = self.getHighlightedResults();

                  if ($highlighted.length === 0) {
                      return;
                  }

                  $highlighted.trigger('mouseup');
              });

              container.on('results:select', function () {
                  var $highlighted = self.getHighlightedResults();

                  if ($highlighted.length === 0) {
                      return;
                  }

                  var data = $highlighted.data('data');

                  if ($highlighted.attr('aria-selected') == 'true') {
                      self.trigger('close', {});
                  } else {
                      self.trigger('select', {
                          data: data
                      });
                  }
              });

              container.on('results:previous', function () {
                  var $highlighted = self.getHighlightedResults();

                  var $options = self.$results.find('[aria-selected]');

                  var currentIndex = $options.index($highlighted);

                  // If we are already at te top, don't move further
                  if (currentIndex === 0) {
                      return;
                  }

                  var nextIndex = currentIndex - 1;

                  // If none are highlighted, highlight the first
                  if ($highlighted.length === 0) {
                      nextIndex = 0;
                  }

                  var $next = $options.eq(nextIndex);

                  $next.trigger('mouseenter');

                  var currentOffset = self.$results.offset().top;
                  var nextTop = $next.offset().top;
                  var nextOffset = self.$results.scrollTop() + (nextTop - currentOffset);

                  if (nextIndex === 0) {
                      self.$results.scrollTop(0);
                  } else if (nextTop - currentOffset < 0) {
                      self.$results.scrollTop(nextOffset);
                  }
              });

              container.on('results:next', function () {
                  var $highlighted = self.getHighlightedResults();

                  var $options = self.$results.find('[aria-selected]');

                  var currentIndex = $options.index($highlighted);

                  var nextIndex = currentIndex + 1;

                  // If we are at the last option, stay there
                  if (nextIndex >= $options.length) {
                      return;
                  }

                  var $next = $options.eq(nextIndex);

                  $next.trigger('mouseenter');

                  var currentOffset = self.$results.offset().top +
                    self.$results.outerHeight(false);
                  var nextBottom = $next.offset().top + $next.outerHeight(false);
                  var nextOffset = self.$results.scrollTop() + nextBottom - currentOffset;

                  if (nextIndex === 0) {
                      self.$results.scrollTop(0);
                  } else if (nextBottom > currentOffset) {
                      self.$results.scrollTop(nextOffset);
                  }
              });

              container.on('results:focus', function (params) {
                  params.element.addClass('select2-results__option--highlighted');
              });

              container.on('results:message', function (params) {
                  self.displayMessage(params);
              });

              if ($.fn.mousewheel) {
                  this.$results.on('mousewheel', function (e) {
                      var top = self.$results.scrollTop();

                      var bottom = (
                        self.$results.get(0).scrollHeight -
                        self.$results.scrollTop() +
                        e.deltaY
                      );

                      var isAtTop = e.deltaY > 0 && top - e.deltaY <= 0;
                      var isAtBottom = e.deltaY < 0 && bottom <= self.$results.height();

                      if (isAtTop) {
                          self.$results.scrollTop(0);

                          e.preventDefault();
                          e.stopPropagation();
                      } else if (isAtBottom) {
                          self.$results.scrollTop(
                            self.$results.get(0).scrollHeight - self.$results.height()
                          );

                          e.preventDefault();
                          e.stopPropagation();
                      }

                  });
              }

              this.$results.on('mouseup', '.select2-results__option[aria-selected]',
                function (evt) {
                    var $this = $(this);

                    var data = $this.data('data');

                    if ($this.attr('aria-selected') === 'true') {
                        if (self.options.get('multiple')) {
                            self.trigger('unselect', {
                                originalEvent: evt,
                                data: data
                            });
                        } else {
                            self.trigger('close', {});
                        }

                        return;
                    }

                    self.trigger('select', {
                        originalEvent: evt,
                        data: data
                    });
                });

              this.$results.on('mouseenter', '.select2-results__option[aria-selected]',
                function (evt) {
                    var data = $(this).data('data');

                    self.getHighlightedResults()
                        .removeClass('select2-results__option--highlighted');

                    self.trigger('results:focus', {
                        data: data,
                        element: $(this)
                    });
                });
          };

          Results.prototype.getHighlightedResults = function () {
              var $highlighted = this.$results
              .find('.select2-results__option--highlighted');

              return $highlighted;
          };

          Results.prototype.destroy = function () {
              this.$results.remove();
          };

          Results.prototype.ensureHighlightVisible = function () {
              var $highlighted = this.getHighlightedResults();

              if ($highlighted.length === 0) {
                  return;
              }

              var $options = this.$results.find('[aria-selected]');

              var currentIndex = $options.index($highlighted);

              var currentOffset = this.$results.offset().top;
              var nextTop = $highlighted.offset().top;
              var nextOffset = this.$results.scrollTop() + (nextTop - currentOffset);

              var offsetDelta = nextTop - currentOffset;
              nextOffset -= $highlighted.outerHeight(false) * 2;

              if (currentIndex <= 2) {
                  this.$results.scrollTop(0);
              } else if (offsetDelta > this.$results.outerHeight() || offsetDelta < 0) {
                  this.$results.scrollTop(nextOffset);
              }
          };

          Results.prototype.template = function (result, container) {
              var template = this.options.get('templateResult');
              var escapeMarkup = this.options.get('escapeMarkup');

              var content = template(result, container);

              if (content == null) {
                  container.style.display = 'none';
              } else if (typeof content === 'string') {
                  container.innerHTML = escapeMarkup(content);
              } else {
                  $(container).append(content);
              }
          };

          return Results;
      });

      S2.define('select2/keys', [

      ], function () {
          var KEYS = {
              BACKSPACE: 8,
              TAB: 9,
              ENTER: 13,
              SHIFT: 16,
              CTRL: 17,
              ALT: 18,
              ESC: 27,
              SPACE: 32,
              PAGE_UP: 33,
              PAGE_DOWN: 34,
              END: 35,
              HOME: 36,
              LEFT: 37,
              UP: 38,
              RIGHT: 39,
              DOWN: 40,
              DELETE: 46
          };

          return KEYS;
      });

      S2.define('select2/selection/base', [
        'jquery',
        '../utils',
        '../keys'
      ], function ($, Utils, KEYS) {
          function BaseSelection($element, options) {
              this.$element = $element;
              this.options = options;

              BaseSelection.__super__.constructor.call(this);
          }

          Utils.Extend(BaseSelection, Utils.Observable);

          BaseSelection.prototype.render = function () {
              var $selection = $(
                '<span class="select2-selection" role="combobox" ' +
                ' aria-haspopup="true" aria-expanded="false">' +
                '</span>'
              );

              this._tabindex = 0;

              if (this.$element.data('old-tabindex') != null) {
                  this._tabindex = this.$element.data('old-tabindex');
              } else if (this.$element.attr('tabindex') != null) {
                  this._tabindex = this.$element.attr('tabindex');
              }

              $selection.attr('title', this.$element.attr('title'));
              $selection.attr('tabindex', this._tabindex);

              this.$selection = $selection;

              return $selection;
          };

          BaseSelection.prototype.bind = function (container, $container) {
              var self = this;

              var id = container.id + '-container';
              var resultsId = container.id + '-results';

              this.container = container;

              this.$selection.on('focus', function (evt) {
                  self.trigger('focus', evt);
              });

              this.$selection.on('blur', function (evt) {
                  self._handleBlur(evt);
              });

              this.$selection.on('keydown', function (evt) {
                  self.trigger('keypress', evt);

                  if (evt.which === KEYS.SPACE) {
                      evt.preventDefault();
                  }
              });

              container.on('results:focus', function (params) {
                  self.$selection.attr('aria-activedescendant', params.data._resultId);
              });

              container.on('selection:update', function (params) {
                  self.update(params.data);
              });

              container.on('open', function () {
                  // When the dropdown is open, aria-expanded="true"
                  self.$selection.attr('aria-expanded', 'true');
                  self.$selection.attr('aria-owns', resultsId);

                  self._attachCloseHandler(container);
              });

              container.on('close', function () {
                  // When the dropdown is closed, aria-expanded="false"
                  self.$selection.attr('aria-expanded', 'false');
                  self.$selection.removeAttr('aria-activedescendant');
                  self.$selection.removeAttr('aria-owns');

                  self.$selection.focus();

                  self._detachCloseHandler(container);
              });

              container.on('enable', function () {
                  self.$selection.attr('tabindex', self._tabindex);
              });

              container.on('disable', function () {
                  self.$selection.attr('tabindex', '-1');
              });
          };

          BaseSelection.prototype._handleBlur = function (evt) {
              var self = this;

              // This needs to be delayed as the active element is the body when the tab
              // key is pressed, possibly along with others.
              window.setTimeout(function () {
                  // Don't trigger `blur` if the focus is still in the selection
                  if (
                    (document.activeElement == self.$selection[0]) ||
                    ($.contains(self.$selection[0], document.activeElement))
                  ) {
                      return;
                  }

                  self.trigger('blur', evt);
              }, 1);
          };

          BaseSelection.prototype._attachCloseHandler = function (container) {
              var self = this;

              $(document.body).on('mousedown.select2.' + container.id, function (e) {
                  var $target = $(e.target);

                  var $select = $target.closest('.select2');

                  var $all = $('.select2.select2-container--open');

                  $all.each(function () {
                      var $this = $(this);

                      if (this == $select[0]) {
                          return;
                      }

                      var $element = $this.data('element');

                      $element.select2('close');
                  });
              });
          };

          BaseSelection.prototype._detachCloseHandler = function (container) {
              $(document.body).off('mousedown.select2.' + container.id);
          };

          BaseSelection.prototype.position = function ($selection, $container) {
              var $selectionContainer = $container.find('.selection');
              $selectionContainer.append($selection);
          };

          BaseSelection.prototype.destroy = function () {
              this._detachCloseHandler(this.container);
          };

          BaseSelection.prototype.update = function (data) {
              throw new Error('The `update` method must be defined in child classes.');
          };

          return BaseSelection;
      });

      S2.define('select2/selection/single', [
        'jquery',
        './base',
        '../utils',
        '../keys'
      ], function ($, BaseSelection, Utils, KEYS) {
          function SingleSelection() {
              SingleSelection.__super__.constructor.apply(this, arguments);
          }

          Utils.Extend(SingleSelection, BaseSelection);

          SingleSelection.prototype.render = function () {
              var $selection = SingleSelection.__super__.render.call(this);

              $selection.addClass('select2-selection--single');

              $selection.html(
                '<span class="select2-selection__rendered"></span>' +
                '<span class="select2-selection__arrow" role="presentation">' +
                  '<b role="presentation"></b>' +
                '</span>'
              );

              return $selection;
          };

          SingleSelection.prototype.bind = function (container, $container) {
              var self = this;

              SingleSelection.__super__.bind.apply(this, arguments);

              var id = container.id + '-container';

              this.$selection.find('.select2-selection__rendered').attr('id', id);
              this.$selection.attr('aria-labelledby', id);

              this.$selection.on('mousedown', function (evt) {
                  // Only respond to left clicks
                  if (evt.which !== 1) {
                      return;
                  }

                  self.trigger('toggle', {
                      originalEvent: evt
                  });
              });

              this.$selection.on('focus', function (evt) {
                  // User focuses on the container
              });

              this.$selection.on('blur', function (evt) {
                  // User exits the container
              });

              container.on('selection:update', function (params) {
                  self.update(params.data);
              });
          };

          SingleSelection.prototype.clear = function () {
              this.$selection.find('.select2-selection__rendered').empty();
          };

          SingleSelection.prototype.display = function (data, container) {
              var template = this.options.get('templateSelection');
              var escapeMarkup = this.options.get('escapeMarkup');

              return escapeMarkup(template(data, container));
          };

          SingleSelection.prototype.selectionContainer = function () {
              return $('<span></span>');
          };

          SingleSelection.prototype.update = function (data) {
              if (data.length === 0) {
                  this.clear();
                  return;
              }

              var selection = data[0];

              var $rendered = this.$selection.find('.select2-selection__rendered');
              var formatted = this.display(selection, $rendered);

              $rendered.empty().append(formatted);
              $rendered.prop('title', selection.title || selection.text);
          };

          return SingleSelection;
      });

      S2.define('select2/selection/multiple', [
        'jquery',
        './base',
        '../utils'
      ], function ($, BaseSelection, Utils) {
          function MultipleSelection($element, options) {
              MultipleSelection.__super__.constructor.apply(this, arguments);
          }

          Utils.Extend(MultipleSelection, BaseSelection);

          MultipleSelection.prototype.render = function () {
              var $selection = MultipleSelection.__super__.render.call(this);

              $selection.addClass('select2-selection--multiple');

              $selection.html(
                '<ul class="select2-selection__rendered"></ul>'
              );

              return $selection;
          };

          MultipleSelection.prototype.bind = function (container, $container) {
              var self = this;

              MultipleSelection.__super__.bind.apply(this, arguments);

              this.$selection.on('click', function (evt) {
                  self.trigger('toggle', {
                      originalEvent: evt
                  });
              });

              this.$selection.on(
                'click',
                '.select2-selection__choice__remove',
                function (evt) {
                    // Ignore the event if it is disabled
                    if (self.options.get('disabled')) {
                        return;
                    }

                    var $remove = $(this);
                    var $selection = $remove.parent();

                    var data = $selection.data('data');

                    self.trigger('unselect', {
                        originalEvent: evt,
                        data: data
                    });
                }
              );
          };

          MultipleSelection.prototype.clear = function () {
              this.$selection.find('.select2-selection__rendered').empty();
          };

          MultipleSelection.prototype.display = function (data, container) {
              var template = this.options.get('templateSelection');
              var escapeMarkup = this.options.get('escapeMarkup');

              return escapeMarkup(template(data, container));
          };

          MultipleSelection.prototype.selectionContainer = function () {
              var $container = $(
                '<li class="select2-selection__choice">' +
                  '<span class="select2-selection__choice__remove" role="presentation">' +
                    '&times;' +
                  '</span>' +
                '</li>'
              );

              return $container;
          };

          MultipleSelection.prototype.update = function (data) {
              this.clear();

              if (data.length === 0) {
                  return;
              }

              var $selections = [];

              for (var d = 0; d < data.length; d++) {
                  var selection = data[d];

                  var $selection = this.selectionContainer();
                  var formatted = this.display(selection, $selection);

                  $selection.append(formatted);
                  $selection.prop('title', selection.title || selection.text);

                  $selection.data('data', selection);

                  $selections.push($selection);
              }

              var $rendered = this.$selection.find('.select2-selection__rendered');

              Utils.appendMany($rendered, $selections);
          };

          return MultipleSelection;
      });

      S2.define('select2/selection/placeholder', [
        '../utils'
      ], function (Utils) {
          function Placeholder(decorated, $element, options) {
              this.placeholder = this.normalizePlaceholder(options.get('placeholder'));

              decorated.call(this, $element, options);
          }

          Placeholder.prototype.normalizePlaceholder = function (_, placeholder) {
              if (typeof placeholder === 'string') {
                  placeholder = {
                      id: '',
                      text: placeholder
                  };
              }

              return placeholder;
          };

          Placeholder.prototype.createPlaceholder = function (decorated, placeholder) {
              var $placeholder = this.selectionContainer();

              $placeholder.html(this.display(placeholder));
              $placeholder.addClass('select2-selection__placeholder')
                          .removeClass('select2-selection__choice');

              return $placeholder;
          };

          Placeholder.prototype.update = function (decorated, data) {
              var singlePlaceholder = (
                data.length == 1 && data[0].id != this.placeholder.id
              );
              var multipleSelections = data.length > 1;

              if (multipleSelections || singlePlaceholder) {
                  return decorated.call(this, data);
              }

              this.clear();

              var $placeholder = this.createPlaceholder(this.placeholder);

              this.$selection.find('.select2-selection__rendered').append($placeholder);
          };

          return Placeholder;
      });

      S2.define('select2/selection/allowClear', [
        'jquery',
        '../keys'
      ], function ($, KEYS) {
          function AllowClear() { }

          AllowClear.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              if (this.placeholder == null) {
                  if (this.options.get('debug') && window.console && console.error) {
                      console.error(
                        'Select2: The `allowClear` option should be used in combination ' +
                        'with the `placeholder` option.'
                      );
                  }
              }

              this.$selection.on('mousedown', '.select2-selection__clear',
                function (evt) {
                    self._handleClear(evt);
                });

              container.on('keypress', function (evt) {
                  self._handleKeyboardClear(evt, container);
              });
          };

          AllowClear.prototype._handleClear = function (_, evt) {
              // Ignore the event if it is disabled
              if (this.options.get('disabled')) {
                  return;
              }

              var $clear = this.$selection.find('.select2-selection__clear');

              // Ignore the event if nothing has been selected
              if ($clear.length === 0) {
                  return;
              }

              evt.stopPropagation();

              var data = $clear.data('data');

              for (var d = 0; d < data.length; d++) {
                  var unselectData = {
                      data: data[d]
                  };

                  // Trigger the `unselect` event, so people can prevent it from being
                  // cleared.
                  this.trigger('unselect', unselectData);

                  // If the event was prevented, don't clear it out.
                  if (unselectData.prevented) {
                      return;
                  }
              }

              this.$element.val(this.placeholder.id).trigger('change');

              this.trigger('toggle', {});
          };

          AllowClear.prototype._handleKeyboardClear = function (_, evt, container) {
              if (container.isOpen()) {
                  return;
              }

              if (evt.which == KEYS.DELETE || evt.which == KEYS.BACKSPACE) {
                  this._handleClear(evt);
              }
          };

          AllowClear.prototype.update = function (decorated, data) {
              decorated.call(this, data);

              if (this.$selection.find('.select2-selection__placeholder').length > 0 ||
                  data.length === 0) {
                  return;
              }

              var $remove = $(
                '<span class="select2-selection__clear">' +
                  '&times;' +
                '</span>'
              );
              $remove.data('data', data);

              this.$selection.find('.select2-selection__rendered').prepend($remove);
          };

          return AllowClear;
      });

      S2.define('select2/selection/search', [
        'jquery',
        '../utils',
        '../keys'
      ], function ($, Utils, KEYS) {
          function Search(decorated, $element, options) {
              decorated.call(this, $element, options);
          }

          Search.prototype.render = function (decorated) {
              var $search = $(
                '<li class="select2-search select2-search--inline">' +
                  '<input class="select2-search__field" type="search" tabindex="-1"' +
                  ' autocomplete="off" autocorrect="off" autocapitalize="off"' +
                  ' spellcheck="false" role="textbox" aria-autocomplete="list" />' +
                '</li>'
              );

              this.$searchContainer = $search;
              this.$search = $search.find('input');

              var $rendered = decorated.call(this);

              this._transferTabIndex();

              return $rendered;
          };

          Search.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              container.on('open', function () {
                  self.$search.trigger('focus');
              });

              container.on('close', function () {
                  self.$search.val('');
                  self.$search.removeAttr('aria-activedescendant');
                  self.$search.trigger('focus');
              });

              container.on('enable', function () {
                  self.$search.prop('disabled', false);

                  self._transferTabIndex();
              });

              container.on('disable', function () {
                  self.$search.prop('disabled', true);
              });

              container.on('focus', function (evt) {
                  self.$search.trigger('focus');
              });

              container.on('results:focus', function (params) {
                  self.$search.attr('aria-activedescendant', params.id);
              });

              this.$selection.on('focusin', '.select2-search--inline', function (evt) {
                  self.trigger('focus', evt);
              });

              this.$selection.on('focusout', '.select2-search--inline', function (evt) {
                  self._handleBlur(evt);
              });

              this.$selection.on('keydown', '.select2-search--inline', function (evt) {
                  evt.stopPropagation();

                  self.trigger('keypress', evt);

                  self._keyUpPrevented = evt.isDefaultPrevented();

                  var key = evt.which;

                  if (key === KEYS.BACKSPACE && self.$search.val() === '') {
                      var $previousChoice = self.$searchContainer
                        .prev('.select2-selection__choice');

                      if ($previousChoice.length > 0) {
                          var item = $previousChoice.data('data');

                          self.searchRemoveChoice(item);

                          evt.preventDefault();
                      }
                  }
              });

              // Try to detect the IE version should the `documentMode` property that
              // is stored on the document. This is only implemented in IE and is
              // slightly cleaner than doing a user agent check.
              // This property is not available in Edge, but Edge also doesn't have
              // this bug.
              var msie = document.documentMode;
              var disableInputEvents = msie && msie <= 11;

              // Workaround for browsers which do not support the `input` event
              // This will prevent double-triggering of events for browsers which support
              // both the `keyup` and `input` events.
              this.$selection.on(
                'input.searchcheck',
                '.select2-search--inline',
                function (evt) {
                    // IE will trigger the `input` event when a placeholder is used on a
                    // search box. To get around this issue, we are forced to ignore all
                    // `input` events in IE and keep using `keyup`.
                    if (disableInputEvents) {
                        self.$selection.off('input.search input.searchcheck');
                        return;
                    }

                    // Unbind the duplicated `keyup` event
                    self.$selection.off('keyup.search');
                }
              );

              this.$selection.on(
                'keyup.search input.search',
                '.select2-search--inline',
                function (evt) {
                    // IE will trigger the `input` event when a placeholder is used on a
                    // search box. To get around this issue, we are forced to ignore all
                    // `input` events in IE and keep using `keyup`.
                    if (disableInputEvents && evt.type === 'input') {
                        self.$selection.off('input.search input.searchcheck');
                        return;
                    }

                    var key = evt.which;

                    // We can freely ignore events from modifier keys
                    if (key == KEYS.SHIFT || key == KEYS.CTRL || key == KEYS.ALT) {
                        return;
                    }

                    // Tabbing will be handled during the `keydown` phase
                    if (key == KEYS.TAB) {
                        return;
                    }

                    self.handleSearch(evt);
                }
              );
          };

          /**
           * This method will transfer the tabindex attribute from the rendered
           * selection to the search box. This allows for the search box to be used as
           * the primary focus instead of the selection container.
           *
           * @private
           */
          Search.prototype._transferTabIndex = function (decorated) {
              this.$search.attr('tabindex', this.$selection.attr('tabindex'));
              this.$selection.attr('tabindex', '-1');
          };

          Search.prototype.createPlaceholder = function (decorated, placeholder) {
              this.$search.attr('placeholder', placeholder.text);
          };

          Search.prototype.update = function (decorated, data) {
              var searchHadFocus = this.$search[0] == document.activeElement;

              this.$search.attr('placeholder', '');

              decorated.call(this, data);

              this.$selection.find('.select2-selection__rendered')
                             .append(this.$searchContainer);

              this.resizeSearch();
              if (searchHadFocus) {
                  this.$search.focus();
              }
          };

          Search.prototype.handleSearch = function () {
              this.resizeSearch();

              if (!this._keyUpPrevented) {
                  var input = this.$search.val();

                  this.trigger('query', {
                      term: input
                  });
              }

              this._keyUpPrevented = false;
          };

          Search.prototype.searchRemoveChoice = function (decorated, item) {
              this.trigger('unselect', {
                  data: item
              });

              this.$search.val(item.text);
              this.handleSearch();
          };

          Search.prototype.resizeSearch = function () {
              this.$search.css('width', '25px');

              var width = '';

              if (this.$search.attr('placeholder') !== '') {
                  width = this.$selection.find('.select2-selection__rendered').innerWidth();
              } else {
                  var minimumWidth = this.$search.val().length + 1;

                  width = (minimumWidth * 0.75) + 'em';
              }

              this.$search.css('width', width);
          };

          return Search;
      });

      S2.define('select2/selection/eventRelay', [
        'jquery'
      ], function ($) {
          function EventRelay() { }

          EventRelay.prototype.bind = function (decorated, container, $container) {
              var self = this;
              var relayEvents = [
                'open', 'opening',
                'close', 'closing',
                'select', 'selecting',
                'unselect', 'unselecting'
              ];

              var preventableEvents = ['opening', 'closing', 'selecting', 'unselecting'];

              decorated.call(this, container, $container);

              container.on('*', function (name, params) {
                  // Ignore events that should not be relayed
                  if ($.inArray(name, relayEvents) === -1) {
                      return;
                  }

                  // The parameters should always be an object
                  params = params || {};

                  // Generate the jQuery event for the Select2 event
                  var evt = $.Event('select2:' + name, {
                      params: params
                  });

                  self.$element.trigger(evt);

                  // Only handle preventable events if it was one
                  if ($.inArray(name, preventableEvents) === -1) {
                      return;
                  }

                  params.prevented = evt.isDefaultPrevented();
              });
          };

          return EventRelay;
      });

      S2.define('select2/translation', [
        'jquery',
        'require'
      ], function ($, require) {
          function Translation(dict) {
              this.dict = dict || {};
          }

          Translation.prototype.all = function () {
              return this.dict;
          };

          Translation.prototype.get = function (key) {
              return this.dict[key];
          };

          Translation.prototype.extend = function (translation) {
              this.dict = $.extend({}, translation.all(), this.dict);
          };

          // Static functions

          Translation._cache = {};

          Translation.loadPath = function (path) {
              if (!(path in Translation._cache)) {
                  var translations = require(path);

                  Translation._cache[path] = translations;
              }

              return new Translation(Translation._cache[path]);
          };

          return Translation;
      });

      S2.define('select2/diacritics', [

      ], function () {
          var diacritics = {
              '\u24B6': 'A',
              '\uFF21': 'A',
              '\u00C0': 'A',
              '\u00C1': 'A',
              '\u00C2': 'A',
              '\u1EA6': 'A',
              '\u1EA4': 'A',
              '\u1EAA': 'A',
              '\u1EA8': 'A',
              '\u00C3': 'A',
              '\u0100': 'A',
              '\u0102': 'A',
              '\u1EB0': 'A',
              '\u1EAE': 'A',
              '\u1EB4': 'A',
              '\u1EB2': 'A',
              '\u0226': 'A',
              '\u01E0': 'A',
              '\u00C4': 'A',
              '\u01DE': 'A',
              '\u1EA2': 'A',
              '\u00C5': 'A',
              '\u01FA': 'A',
              '\u01CD': 'A',
              '\u0200': 'A',
              '\u0202': 'A',
              '\u1EA0': 'A',
              '\u1EAC': 'A',
              '\u1EB6': 'A',
              '\u1E00': 'A',
              '\u0104': 'A',
              '\u023A': 'A',
              '\u2C6F': 'A',
              '\uA732': 'AA',
              '\u00C6': 'AE',
              '\u01FC': 'AE',
              '\u01E2': 'AE',
              '\uA734': 'AO',
              '\uA736': 'AU',
              '\uA738': 'AV',
              '\uA73A': 'AV',
              '\uA73C': 'AY',
              '\u24B7': 'B',
              '\uFF22': 'B',
              '\u1E02': 'B',
              '\u1E04': 'B',
              '\u1E06': 'B',
              '\u0243': 'B',
              '\u0182': 'B',
              '\u0181': 'B',
              '\u24B8': 'C',
              '\uFF23': 'C',
              '\u0106': 'C',
              '\u0108': 'C',
              '\u010A': 'C',
              '\u010C': 'C',
              '\u00C7': 'C',
              '\u1E08': 'C',
              '\u0187': 'C',
              '\u023B': 'C',
              '\uA73E': 'C',
              '\u24B9': 'D',
              '\uFF24': 'D',
              '\u1E0A': 'D',
              '\u010E': 'D',
              '\u1E0C': 'D',
              '\u1E10': 'D',
              '\u1E12': 'D',
              '\u1E0E': 'D',
              '\u0110': 'D',
              '\u018B': 'D',
              '\u018A': 'D',
              '\u0189': 'D',
              '\uA779': 'D',
              '\u01F1': 'DZ',
              '\u01C4': 'DZ',
              '\u01F2': 'Dz',
              '\u01C5': 'Dz',
              '\u24BA': 'E',
              '\uFF25': 'E',
              '\u00C8': 'E',
              '\u00C9': 'E',
              '\u00CA': 'E',
              '\u1EC0': 'E',
              '\u1EBE': 'E',
              '\u1EC4': 'E',
              '\u1EC2': 'E',
              '\u1EBC': 'E',
              '\u0112': 'E',
              '\u1E14': 'E',
              '\u1E16': 'E',
              '\u0114': 'E',
              '\u0116': 'E',
              '\u00CB': 'E',
              '\u1EBA': 'E',
              '\u011A': 'E',
              '\u0204': 'E',
              '\u0206': 'E',
              '\u1EB8': 'E',
              '\u1EC6': 'E',
              '\u0228': 'E',
              '\u1E1C': 'E',
              '\u0118': 'E',
              '\u1E18': 'E',
              '\u1E1A': 'E',
              '\u0190': 'E',
              '\u018E': 'E',
              '\u24BB': 'F',
              '\uFF26': 'F',
              '\u1E1E': 'F',
              '\u0191': 'F',
              '\uA77B': 'F',
              '\u24BC': 'G',
              '\uFF27': 'G',
              '\u01F4': 'G',
              '\u011C': 'G',
              '\u1E20': 'G',
              '\u011E': 'G',
              '\u0120': 'G',
              '\u01E6': 'G',
              '\u0122': 'G',
              '\u01E4': 'G',
              '\u0193': 'G',
              '\uA7A0': 'G',
              '\uA77D': 'G',
              '\uA77E': 'G',
              '\u24BD': 'H',
              '\uFF28': 'H',
              '\u0124': 'H',
              '\u1E22': 'H',
              '\u1E26': 'H',
              '\u021E': 'H',
              '\u1E24': 'H',
              '\u1E28': 'H',
              '\u1E2A': 'H',
              '\u0126': 'H',
              '\u2C67': 'H',
              '\u2C75': 'H',
              '\uA78D': 'H',
              '\u24BE': 'I',
              '\uFF29': 'I',
              '\u00CC': 'I',
              '\u00CD': 'I',
              '\u00CE': 'I',
              '\u0128': 'I',
              '\u012A': 'I',
              '\u012C': 'I',
              '\u0130': 'I',
              '\u00CF': 'I',
              '\u1E2E': 'I',
              '\u1EC8': 'I',
              '\u01CF': 'I',
              '\u0208': 'I',
              '\u020A': 'I',
              '\u1ECA': 'I',
              '\u012E': 'I',
              '\u1E2C': 'I',
              '\u0197': 'I',
              '\u24BF': 'J',
              '\uFF2A': 'J',
              '\u0134': 'J',
              '\u0248': 'J',
              '\u24C0': 'K',
              '\uFF2B': 'K',
              '\u1E30': 'K',
              '\u01E8': 'K',
              '\u1E32': 'K',
              '\u0136': 'K',
              '\u1E34': 'K',
              '\u0198': 'K',
              '\u2C69': 'K',
              '\uA740': 'K',
              '\uA742': 'K',
              '\uA744': 'K',
              '\uA7A2': 'K',
              '\u24C1': 'L',
              '\uFF2C': 'L',
              '\u013F': 'L',
              '\u0139': 'L',
              '\u013D': 'L',
              '\u1E36': 'L',
              '\u1E38': 'L',
              '\u013B': 'L',
              '\u1E3C': 'L',
              '\u1E3A': 'L',
              '\u0141': 'L',
              '\u023D': 'L',
              '\u2C62': 'L',
              '\u2C60': 'L',
              '\uA748': 'L',
              '\uA746': 'L',
              '\uA780': 'L',
              '\u01C7': 'LJ',
              '\u01C8': 'Lj',
              '\u24C2': 'M',
              '\uFF2D': 'M',
              '\u1E3E': 'M',
              '\u1E40': 'M',
              '\u1E42': 'M',
              '\u2C6E': 'M',
              '\u019C': 'M',
              '\u24C3': 'N',
              '\uFF2E': 'N',
              '\u01F8': 'N',
              '\u0143': 'N',
              '\u00D1': 'N',
              '\u1E44': 'N',
              '\u0147': 'N',
              '\u1E46': 'N',
              '\u0145': 'N',
              '\u1E4A': 'N',
              '\u1E48': 'N',
              '\u0220': 'N',
              '\u019D': 'N',
              '\uA790': 'N',
              '\uA7A4': 'N',
              '\u01CA': 'NJ',
              '\u01CB': 'Nj',
              '\u24C4': 'O',
              '\uFF2F': 'O',
              '\u00D2': 'O',
              '\u00D3': 'O',
              '\u00D4': 'O',
              '\u1ED2': 'O',
              '\u1ED0': 'O',
              '\u1ED6': 'O',
              '\u1ED4': 'O',
              '\u00D5': 'O',
              '\u1E4C': 'O',
              '\u022C': 'O',
              '\u1E4E': 'O',
              '\u014C': 'O',
              '\u1E50': 'O',
              '\u1E52': 'O',
              '\u014E': 'O',
              '\u022E': 'O',
              '\u0230': 'O',
              '\u00D6': 'O',
              '\u022A': 'O',
              '\u1ECE': 'O',
              '\u0150': 'O',
              '\u01D1': 'O',
              '\u020C': 'O',
              '\u020E': 'O',
              '\u01A0': 'O',
              '\u1EDC': 'O',
              '\u1EDA': 'O',
              '\u1EE0': 'O',
              '\u1EDE': 'O',
              '\u1EE2': 'O',
              '\u1ECC': 'O',
              '\u1ED8': 'O',
              '\u01EA': 'O',
              '\u01EC': 'O',
              '\u00D8': 'O',
              '\u01FE': 'O',
              '\u0186': 'O',
              '\u019F': 'O',
              '\uA74A': 'O',
              '\uA74C': 'O',
              '\u01A2': 'OI',
              '\uA74E': 'OO',
              '\u0222': 'OU',
              '\u24C5': 'P',
              '\uFF30': 'P',
              '\u1E54': 'P',
              '\u1E56': 'P',
              '\u01A4': 'P',
              '\u2C63': 'P',
              '\uA750': 'P',
              '\uA752': 'P',
              '\uA754': 'P',
              '\u24C6': 'Q',
              '\uFF31': 'Q',
              '\uA756': 'Q',
              '\uA758': 'Q',
              '\u024A': 'Q',
              '\u24C7': 'R',
              '\uFF32': 'R',
              '\u0154': 'R',
              '\u1E58': 'R',
              '\u0158': 'R',
              '\u0210': 'R',
              '\u0212': 'R',
              '\u1E5A': 'R',
              '\u1E5C': 'R',
              '\u0156': 'R',
              '\u1E5E': 'R',
              '\u024C': 'R',
              '\u2C64': 'R',
              '\uA75A': 'R',
              '\uA7A6': 'R',
              '\uA782': 'R',
              '\u24C8': 'S',
              '\uFF33': 'S',
              '\u1E9E': 'S',
              '\u015A': 'S',
              '\u1E64': 'S',
              '\u015C': 'S',
              '\u1E60': 'S',
              '\u0160': 'S',
              '\u1E66': 'S',
              '\u1E62': 'S',
              '\u1E68': 'S',
              '\u0218': 'S',
              '\u015E': 'S',
              '\u2C7E': 'S',
              '\uA7A8': 'S',
              '\uA784': 'S',
              '\u24C9': 'T',
              '\uFF34': 'T',
              '\u1E6A': 'T',
              '\u0164': 'T',
              '\u1E6C': 'T',
              '\u021A': 'T',
              '\u0162': 'T',
              '\u1E70': 'T',
              '\u1E6E': 'T',
              '\u0166': 'T',
              '\u01AC': 'T',
              '\u01AE': 'T',
              '\u023E': 'T',
              '\uA786': 'T',
              '\uA728': 'TZ',
              '\u24CA': 'U',
              '\uFF35': 'U',
              '\u00D9': 'U',
              '\u00DA': 'U',
              '\u00DB': 'U',
              '\u0168': 'U',
              '\u1E78': 'U',
              '\u016A': 'U',
              '\u1E7A': 'U',
              '\u016C': 'U',
              '\u00DC': 'U',
              '\u01DB': 'U',
              '\u01D7': 'U',
              '\u01D5': 'U',
              '\u01D9': 'U',
              '\u1EE6': 'U',
              '\u016E': 'U',
              '\u0170': 'U',
              '\u01D3': 'U',
              '\u0214': 'U',
              '\u0216': 'U',
              '\u01AF': 'U',
              '\u1EEA': 'U',
              '\u1EE8': 'U',
              '\u1EEE': 'U',
              '\u1EEC': 'U',
              '\u1EF0': 'U',
              '\u1EE4': 'U',
              '\u1E72': 'U',
              '\u0172': 'U',
              '\u1E76': 'U',
              '\u1E74': 'U',
              '\u0244': 'U',
              '\u24CB': 'V',
              '\uFF36': 'V',
              '\u1E7C': 'V',
              '\u1E7E': 'V',
              '\u01B2': 'V',
              '\uA75E': 'V',
              '\u0245': 'V',
              '\uA760': 'VY',
              '\u24CC': 'W',
              '\uFF37': 'W',
              '\u1E80': 'W',
              '\u1E82': 'W',
              '\u0174': 'W',
              '\u1E86': 'W',
              '\u1E84': 'W',
              '\u1E88': 'W',
              '\u2C72': 'W',
              '\u24CD': 'X',
              '\uFF38': 'X',
              '\u1E8A': 'X',
              '\u1E8C': 'X',
              '\u24CE': 'Y',
              '\uFF39': 'Y',
              '\u1EF2': 'Y',
              '\u00DD': 'Y',
              '\u0176': 'Y',
              '\u1EF8': 'Y',
              '\u0232': 'Y',
              '\u1E8E': 'Y',
              '\u0178': 'Y',
              '\u1EF6': 'Y',
              '\u1EF4': 'Y',
              '\u01B3': 'Y',
              '\u024E': 'Y',
              '\u1EFE': 'Y',
              '\u24CF': 'Z',
              '\uFF3A': 'Z',
              '\u0179': 'Z',
              '\u1E90': 'Z',
              '\u017B': 'Z',
              '\u017D': 'Z',
              '\u1E92': 'Z',
              '\u1E94': 'Z',
              '\u01B5': 'Z',
              '\u0224': 'Z',
              '\u2C7F': 'Z',
              '\u2C6B': 'Z',
              '\uA762': 'Z',
              '\u24D0': 'a',
              '\uFF41': 'a',
              '\u1E9A': 'a',
              '\u00E0': 'a',
              '\u00E1': 'a',
              '\u00E2': 'a',
              '\u1EA7': 'a',
              '\u1EA5': 'a',
              '\u1EAB': 'a',
              '\u1EA9': 'a',
              '\u00E3': 'a',
              '\u0101': 'a',
              '\u0103': 'a',
              '\u1EB1': 'a',
              '\u1EAF': 'a',
              '\u1EB5': 'a',
              '\u1EB3': 'a',
              '\u0227': 'a',
              '\u01E1': 'a',
              '\u00E4': 'a',
              '\u01DF': 'a',
              '\u1EA3': 'a',
              '\u00E5': 'a',
              '\u01FB': 'a',
              '\u01CE': 'a',
              '\u0201': 'a',
              '\u0203': 'a',
              '\u1EA1': 'a',
              '\u1EAD': 'a',
              '\u1EB7': 'a',
              '\u1E01': 'a',
              '\u0105': 'a',
              '\u2C65': 'a',
              '\u0250': 'a',
              '\uA733': 'aa',
              '\u00E6': 'ae',
              '\u01FD': 'ae',
              '\u01E3': 'ae',
              '\uA735': 'ao',
              '\uA737': 'au',
              '\uA739': 'av',
              '\uA73B': 'av',
              '\uA73D': 'ay',
              '\u24D1': 'b',
              '\uFF42': 'b',
              '\u1E03': 'b',
              '\u1E05': 'b',
              '\u1E07': 'b',
              '\u0180': 'b',
              '\u0183': 'b',
              '\u0253': 'b',
              '\u24D2': 'c',
              '\uFF43': 'c',
              '\u0107': 'c',
              '\u0109': 'c',
              '\u010B': 'c',
              '\u010D': 'c',
              '\u00E7': 'c',
              '\u1E09': 'c',
              '\u0188': 'c',
              '\u023C': 'c',
              '\uA73F': 'c',
              '\u2184': 'c',
              '\u24D3': 'd',
              '\uFF44': 'd',
              '\u1E0B': 'd',
              '\u010F': 'd',
              '\u1E0D': 'd',
              '\u1E11': 'd',
              '\u1E13': 'd',
              '\u1E0F': 'd',
              '\u0111': 'd',
              '\u018C': 'd',
              '\u0256': 'd',
              '\u0257': 'd',
              '\uA77A': 'd',
              '\u01F3': 'dz',
              '\u01C6': 'dz',
              '\u24D4': 'e',
              '\uFF45': 'e',
              '\u00E8': 'e',
              '\u00E9': 'e',
              '\u00EA': 'e',
              '\u1EC1': 'e',
              '\u1EBF': 'e',
              '\u1EC5': 'e',
              '\u1EC3': 'e',
              '\u1EBD': 'e',
              '\u0113': 'e',
              '\u1E15': 'e',
              '\u1E17': 'e',
              '\u0115': 'e',
              '\u0117': 'e',
              '\u00EB': 'e',
              '\u1EBB': 'e',
              '\u011B': 'e',
              '\u0205': 'e',
              '\u0207': 'e',
              '\u1EB9': 'e',
              '\u1EC7': 'e',
              '\u0229': 'e',
              '\u1E1D': 'e',
              '\u0119': 'e',
              '\u1E19': 'e',
              '\u1E1B': 'e',
              '\u0247': 'e',
              '\u025B': 'e',
              '\u01DD': 'e',
              '\u24D5': 'f',
              '\uFF46': 'f',
              '\u1E1F': 'f',
              '\u0192': 'f',
              '\uA77C': 'f',
              '\u24D6': 'g',
              '\uFF47': 'g',
              '\u01F5': 'g',
              '\u011D': 'g',
              '\u1E21': 'g',
              '\u011F': 'g',
              '\u0121': 'g',
              '\u01E7': 'g',
              '\u0123': 'g',
              '\u01E5': 'g',
              '\u0260': 'g',
              '\uA7A1': 'g',
              '\u1D79': 'g',
              '\uA77F': 'g',
              '\u24D7': 'h',
              '\uFF48': 'h',
              '\u0125': 'h',
              '\u1E23': 'h',
              '\u1E27': 'h',
              '\u021F': 'h',
              '\u1E25': 'h',
              '\u1E29': 'h',
              '\u1E2B': 'h',
              '\u1E96': 'h',
              '\u0127': 'h',
              '\u2C68': 'h',
              '\u2C76': 'h',
              '\u0265': 'h',
              '\u0195': 'hv',
              '\u24D8': 'i',
              '\uFF49': 'i',
              '\u00EC': 'i',
              '\u00ED': 'i',
              '\u00EE': 'i',
              '\u0129': 'i',
              '\u012B': 'i',
              '\u012D': 'i',
              '\u00EF': 'i',
              '\u1E2F': 'i',
              '\u1EC9': 'i',
              '\u01D0': 'i',
              '\u0209': 'i',
              '\u020B': 'i',
              '\u1ECB': 'i',
              '\u012F': 'i',
              '\u1E2D': 'i',
              '\u0268': 'i',
              '\u0131': 'i',
              '\u24D9': 'j',
              '\uFF4A': 'j',
              '\u0135': 'j',
              '\u01F0': 'j',
              '\u0249': 'j',
              '\u24DA': 'k',
              '\uFF4B': 'k',
              '\u1E31': 'k',
              '\u01E9': 'k',
              '\u1E33': 'k',
              '\u0137': 'k',
              '\u1E35': 'k',
              '\u0199': 'k',
              '\u2C6A': 'k',
              '\uA741': 'k',
              '\uA743': 'k',
              '\uA745': 'k',
              '\uA7A3': 'k',
              '\u24DB': 'l',
              '\uFF4C': 'l',
              '\u0140': 'l',
              '\u013A': 'l',
              '\u013E': 'l',
              '\u1E37': 'l',
              '\u1E39': 'l',
              '\u013C': 'l',
              '\u1E3D': 'l',
              '\u1E3B': 'l',
              '\u017F': 'l',
              '\u0142': 'l',
              '\u019A': 'l',
              '\u026B': 'l',
              '\u2C61': 'l',
              '\uA749': 'l',
              '\uA781': 'l',
              '\uA747': 'l',
              '\u01C9': 'lj',
              '\u24DC': 'm',
              '\uFF4D': 'm',
              '\u1E3F': 'm',
              '\u1E41': 'm',
              '\u1E43': 'm',
              '\u0271': 'm',
              '\u026F': 'm',
              '\u24DD': 'n',
              '\uFF4E': 'n',
              '\u01F9': 'n',
              '\u0144': 'n',
              '\u00F1': 'n',
              '\u1E45': 'n',
              '\u0148': 'n',
              '\u1E47': 'n',
              '\u0146': 'n',
              '\u1E4B': 'n',
              '\u1E49': 'n',
              '\u019E': 'n',
              '\u0272': 'n',
              '\u0149': 'n',
              '\uA791': 'n',
              '\uA7A5': 'n',
              '\u01CC': 'nj',
              '\u24DE': 'o',
              '\uFF4F': 'o',
              '\u00F2': 'o',
              '\u00F3': 'o',
              '\u00F4': 'o',
              '\u1ED3': 'o',
              '\u1ED1': 'o',
              '\u1ED7': 'o',
              '\u1ED5': 'o',
              '\u00F5': 'o',
              '\u1E4D': 'o',
              '\u022D': 'o',
              '\u1E4F': 'o',
              '\u014D': 'o',
              '\u1E51': 'o',
              '\u1E53': 'o',
              '\u014F': 'o',
              '\u022F': 'o',
              '\u0231': 'o',
              '\u00F6': 'o',
              '\u022B': 'o',
              '\u1ECF': 'o',
              '\u0151': 'o',
              '\u01D2': 'o',
              '\u020D': 'o',
              '\u020F': 'o',
              '\u01A1': 'o',
              '\u1EDD': 'o',
              '\u1EDB': 'o',
              '\u1EE1': 'o',
              '\u1EDF': 'o',
              '\u1EE3': 'o',
              '\u1ECD': 'o',
              '\u1ED9': 'o',
              '\u01EB': 'o',
              '\u01ED': 'o',
              '\u00F8': 'o',
              '\u01FF': 'o',
              '\u0254': 'o',
              '\uA74B': 'o',
              '\uA74D': 'o',
              '\u0275': 'o',
              '\u01A3': 'oi',
              '\u0223': 'ou',
              '\uA74F': 'oo',
              '\u24DF': 'p',
              '\uFF50': 'p',
              '\u1E55': 'p',
              '\u1E57': 'p',
              '\u01A5': 'p',
              '\u1D7D': 'p',
              '\uA751': 'p',
              '\uA753': 'p',
              '\uA755': 'p',
              '\u24E0': 'q',
              '\uFF51': 'q',
              '\u024B': 'q',
              '\uA757': 'q',
              '\uA759': 'q',
              '\u24E1': 'r',
              '\uFF52': 'r',
              '\u0155': 'r',
              '\u1E59': 'r',
              '\u0159': 'r',
              '\u0211': 'r',
              '\u0213': 'r',
              '\u1E5B': 'r',
              '\u1E5D': 'r',
              '\u0157': 'r',
              '\u1E5F': 'r',
              '\u024D': 'r',
              '\u027D': 'r',
              '\uA75B': 'r',
              '\uA7A7': 'r',
              '\uA783': 'r',
              '\u24E2': 's',
              '\uFF53': 's',
              '\u00DF': 's',
              '\u015B': 's',
              '\u1E65': 's',
              '\u015D': 's',
              '\u1E61': 's',
              '\u0161': 's',
              '\u1E67': 's',
              '\u1E63': 's',
              '\u1E69': 's',
              '\u0219': 's',
              '\u015F': 's',
              '\u023F': 's',
              '\uA7A9': 's',
              '\uA785': 's',
              '\u1E9B': 's',
              '\u24E3': 't',
              '\uFF54': 't',
              '\u1E6B': 't',
              '\u1E97': 't',
              '\u0165': 't',
              '\u1E6D': 't',
              '\u021B': 't',
              '\u0163': 't',
              '\u1E71': 't',
              '\u1E6F': 't',
              '\u0167': 't',
              '\u01AD': 't',
              '\u0288': 't',
              '\u2C66': 't',
              '\uA787': 't',
              '\uA729': 'tz',
              '\u24E4': 'u',
              '\uFF55': 'u',
              '\u00F9': 'u',
              '\u00FA': 'u',
              '\u00FB': 'u',
              '\u0169': 'u',
              '\u1E79': 'u',
              '\u016B': 'u',
              '\u1E7B': 'u',
              '\u016D': 'u',
              '\u00FC': 'u',
              '\u01DC': 'u',
              '\u01D8': 'u',
              '\u01D6': 'u',
              '\u01DA': 'u',
              '\u1EE7': 'u',
              '\u016F': 'u',
              '\u0171': 'u',
              '\u01D4': 'u',
              '\u0215': 'u',
              '\u0217': 'u',
              '\u01B0': 'u',
              '\u1EEB': 'u',
              '\u1EE9': 'u',
              '\u1EEF': 'u',
              '\u1EED': 'u',
              '\u1EF1': 'u',
              '\u1EE5': 'u',
              '\u1E73': 'u',
              '\u0173': 'u',
              '\u1E77': 'u',
              '\u1E75': 'u',
              '\u0289': 'u',
              '\u24E5': 'v',
              '\uFF56': 'v',
              '\u1E7D': 'v',
              '\u1E7F': 'v',
              '\u028B': 'v',
              '\uA75F': 'v',
              '\u028C': 'v',
              '\uA761': 'vy',
              '\u24E6': 'w',
              '\uFF57': 'w',
              '\u1E81': 'w',
              '\u1E83': 'w',
              '\u0175': 'w',
              '\u1E87': 'w',
              '\u1E85': 'w',
              '\u1E98': 'w',
              '\u1E89': 'w',
              '\u2C73': 'w',
              '\u24E7': 'x',
              '\uFF58': 'x',
              '\u1E8B': 'x',
              '\u1E8D': 'x',
              '\u24E8': 'y',
              '\uFF59': 'y',
              '\u1EF3': 'y',
              '\u00FD': 'y',
              '\u0177': 'y',
              '\u1EF9': 'y',
              '\u0233': 'y',
              '\u1E8F': 'y',
              '\u00FF': 'y',
              '\u1EF7': 'y',
              '\u1E99': 'y',
              '\u1EF5': 'y',
              '\u01B4': 'y',
              '\u024F': 'y',
              '\u1EFF': 'y',
              '\u24E9': 'z',
              '\uFF5A': 'z',
              '\u017A': 'z',
              '\u1E91': 'z',
              '\u017C': 'z',
              '\u017E': 'z',
              '\u1E93': 'z',
              '\u1E95': 'z',
              '\u01B6': 'z',
              '\u0225': 'z',
              '\u0240': 'z',
              '\u2C6C': 'z',
              '\uA763': 'z',
              '\u0386': '\u0391',
              '\u0388': '\u0395',
              '\u0389': '\u0397',
              '\u038A': '\u0399',
              '\u03AA': '\u0399',
              '\u038C': '\u039F',
              '\u038E': '\u03A5',
              '\u03AB': '\u03A5',
              '\u038F': '\u03A9',
              '\u03AC': '\u03B1',
              '\u03AD': '\u03B5',
              '\u03AE': '\u03B7',
              '\u03AF': '\u03B9',
              '\u03CA': '\u03B9',
              '\u0390': '\u03B9',
              '\u03CC': '\u03BF',
              '\u03CD': '\u03C5',
              '\u03CB': '\u03C5',
              '\u03B0': '\u03C5',
              '\u03C9': '\u03C9',
              '\u03C2': '\u03C3'
          };

          return diacritics;
      });

      S2.define('select2/data/base', [
        '../utils'
      ], function (Utils) {
          function BaseAdapter($element, options) {
              BaseAdapter.__super__.constructor.call(this);
          }

          Utils.Extend(BaseAdapter, Utils.Observable);

          BaseAdapter.prototype.current = function (callback) {
              throw new Error('The `current` method must be defined in child classes.');
          };

          BaseAdapter.prototype.query = function (params, callback) {
              throw new Error('The `query` method must be defined in child classes.');
          };

          BaseAdapter.prototype.bind = function (container, $container) {
              // Can be implemented in subclasses
          };

          BaseAdapter.prototype.destroy = function () {
              // Can be implemented in subclasses
          };

          BaseAdapter.prototype.generateResultId = function (container, data) {
              var id = container.id + '-result-';

              id += Utils.generateChars(4);

              if (data.id != null) {
                  id += '-' + data.id.toString();
              } else {
                  id += '-' + Utils.generateChars(4);
              }
              return id;
          };

          return BaseAdapter;
      });

      S2.define('select2/data/select', [
        './base',
        '../utils',
        'jquery'
      ], function (BaseAdapter, Utils, $) {
          function SelectAdapter($element, options) {
              this.$element = $element;
              this.options = options;

              SelectAdapter.__super__.constructor.call(this);
          }

          Utils.Extend(SelectAdapter, BaseAdapter);

          SelectAdapter.prototype.current = function (callback) {
              var data = [];
              var self = this;

              this.$element.find(':selected').each(function () {
                  var $option = $(this);

                  var option = self.item($option);

                  data.push(option);
              });

              callback(data);
          };

          SelectAdapter.prototype.select = function (data) {
              var self = this;

              data.selected = true;

              // If data.element is a DOM node, use it instead
              if ($(data.element).is('option')) {
                  data.element.selected = true;

                  this.$element.trigger('change');

                  return;
              }

              if (this.$element.prop('multiple')) {
                  this.current(function (currentData) {
                      var val = [];

                      data = [data];
                      data.push.apply(data, currentData);

                      for (var d = 0; d < data.length; d++) {
                          var id = data[d].id;

                          if ($.inArray(id, val) === -1) {
                              val.push(id);
                          }
                      }

                      self.$element.val(val);
                      self.$element.trigger('change');
                  });
              } else {
                  var val = data.id;

                  this.$element.val(val);
                  this.$element.trigger('change');
              }
          };

          SelectAdapter.prototype.unselect = function (data) {
              var self = this;

              if (!this.$element.prop('multiple')) {
                  return;
              }

              data.selected = false;

              if ($(data.element).is('option')) {
                  data.element.selected = false;

                  this.$element.trigger('change');

                  return;
              }

              this.current(function (currentData) {
                  var val = [];

                  for (var d = 0; d < currentData.length; d++) {
                      var id = currentData[d].id;

                      if (id !== data.id && $.inArray(id, val) === -1) {
                          val.push(id);
                      }
                  }

                  self.$element.val(val);

                  self.$element.trigger('change');
              });
          };

          SelectAdapter.prototype.bind = function (container, $container) {
              var self = this;

              this.container = container;

              container.on('select', function (params) {
                  self.select(params.data);
              });

              container.on('unselect', function (params) {
                  self.unselect(params.data);
              });
          };

          SelectAdapter.prototype.destroy = function () {
              // Remove anything added to child elements
              this.$element.find('*').each(function () {
                  // Remove any custom data set by Select2
                  $.removeData(this, 'data');
              });
          };

          SelectAdapter.prototype.query = function (params, callback) {
              var data = [];
              var self = this;

              var $options = this.$element.children();

              $options.each(function () {
                  var $option = $(this);

                  if (!$option.is('option') && !$option.is('optgroup')) {
                      return;
                  }

                  var option = self.item($option);

                  var matches = self.matches(params, option);

                  if (matches !== null) {
                      data.push(matches);
                  }
              });

              callback({
                  results: data
              });
          };

          SelectAdapter.prototype.addOptions = function ($options) {
              Utils.appendMany(this.$element, $options);
          };

          SelectAdapter.prototype.option = function (data) {
              var option;

              if (data.children) {
                  option = document.createElement('optgroup');
                  option.label = data.text;
              } else {
                  option = document.createElement('option');

                  if (option.textContent !== undefined) {
                      option.textContent = data.text;
                  } else {
                      option.innerText = data.text;
                  }
              }

              if (data.id) {
                  option.value = data.id;
              }

              if (data.disabled) {
                  option.disabled = true;
              }

              if (data.selected) {
                  option.selected = true;
              }

              if (data.title) {
                  option.title = data.title;
              }

              var $option = $(option);

              var normalizedData = this._normalizeItem(data);
              normalizedData.element = option;

              // Override the option's data with the combined data
              $.data(option, 'data', normalizedData);

              return $option;
          };

          SelectAdapter.prototype.item = function ($option) {
              var data = {};

              data = $.data($option[0], 'data');

              if (data != null) {
                  return data;
              }

              if ($option.is('option')) {
                  data = {
                      id: $option.val(),
                      text: $option.text(),
                      disabled: $option.prop('disabled'),
                      selected: $option.prop('selected'),
                      title: $option.prop('title')
                  };
              } else if ($option.is('optgroup')) {
                  data = {
                      text: $option.prop('label'),
                      children: [],
                      title: $option.prop('title')
                  };

                  var $children = $option.children('option');
                  var children = [];

                  for (var c = 0; c < $children.length; c++) {
                      var $child = $($children[c]);

                      var child = this.item($child);

                      children.push(child);
                  }

                  data.children = children;
              }

              data = this._normalizeItem(data);
              data.element = $option[0];

              $.data($option[0], 'data', data);

              return data;
          };

          SelectAdapter.prototype._normalizeItem = function (item) {
              if (!$.isPlainObject(item)) {
                  item = {
                      id: item,
                      text: item
                  };
              }

              item = $.extend({}, {
                  text: ''
              }, item);

              var defaults = {
                  selected: false,
                  disabled: false
              };

              if (item.id != null) {
                  item.id = item.id.toString();
              }

              if (item.text != null) {
                  item.text = item.text.toString();
              }

              if (item._resultId == null && item.id && this.container != null) {
                  item._resultId = this.generateResultId(this.container, item);
              }

              return $.extend({}, defaults, item);
          };

          SelectAdapter.prototype.matches = function (params, data) {
              var matcher = this.options.get('matcher');

              return matcher(params, data);
          };

          return SelectAdapter;
      });

      S2.define('select2/data/array', [
        './select',
        '../utils',
        'jquery'
      ], function (SelectAdapter, Utils, $) {
          function ArrayAdapter($element, options) {
              var data = options.get('data') || [];

              ArrayAdapter.__super__.constructor.call(this, $element, options);

              this.addOptions(this.convertToOptions(data));
          }

          Utils.Extend(ArrayAdapter, SelectAdapter);

          ArrayAdapter.prototype.select = function (data) {
              var $option = this.$element.find('option').filter(function (i, elm) {
                  return elm.value == data.id.toString();
              });

              if ($option.length === 0) {
                  $option = this.option(data);

                  this.addOptions($option);
              }

              ArrayAdapter.__super__.select.call(this, data);
          };

          ArrayAdapter.prototype.convertToOptions = function (data) {
              var self = this;

              var $existing = this.$element.find('option');
              var existingIds = $existing.map(function () {
                  return self.item($(this)).id;
              }).get();

              var $options = [];

              // Filter out all items except for the one passed in the argument
              function onlyItem(item) {
                  return function () {
                      return $(this).val() == item.id;
                  };
              }

              for (var d = 0; d < data.length; d++) {
                  var item = this._normalizeItem(data[d]);

                  // Skip items which were pre-loaded, only merge the data
                  if ($.inArray(item.id, existingIds) >= 0) {
                      var $existingOption = $existing.filter(onlyItem(item));

                      var existingData = this.item($existingOption);
                      var newData = $.extend(true, {}, existingData, item);

                      var $newOption = this.option(newData);

                      $existingOption.replaceWith($newOption);

                      continue;
                  }

                  var $option = this.option(item);

                  if (item.children) {
                      var $children = this.convertToOptions(item.children);

                      Utils.appendMany($option, $children);
                  }

                  $options.push($option);
              }

              return $options;
          };

          return ArrayAdapter;
      });

      S2.define('select2/data/ajax', [
        './array',
        '../utils',
        'jquery'
      ], function (ArrayAdapter, Utils, $) {
          function AjaxAdapter($element, options) {
              this.ajaxOptions = this._applyDefaults(options.get('ajax'));

              if (this.ajaxOptions.processResults != null) {
                  this.processResults = this.ajaxOptions.processResults;
              }

              AjaxAdapter.__super__.constructor.call(this, $element, options);
          }

          Utils.Extend(AjaxAdapter, ArrayAdapter);

          AjaxAdapter.prototype._applyDefaults = function (options) {
              var defaults = {
                  data: function (params) {
                      return $.extend({}, params, {
                          q: params.term
                      });
                  },
                  transport: function (params, success, failure) {
                      var $request = $.ajax(params);

                      $request.then(success);
                      $request.fail(failure);

                      return $request;
                  }
              };

              return $.extend({}, defaults, options, true);
          };

          AjaxAdapter.prototype.processResults = function (results) {
              return results;
          };

          AjaxAdapter.prototype.query = function (params, callback) {
              var matches = [];
              var self = this;

              if (this._request != null) {
                  // JSONP requests cannot always be aborted
                  if ($.isFunction(this._request.abort)) {
                      this._request.abort();
                  }

                  this._request = null;
              }

              var options = $.extend({
                  type: 'GET'
              }, this.ajaxOptions);

              if (typeof options.url === 'function') {
                  options.url = options.url.call(this.$element, params);
              }

              if (typeof options.data === 'function') {
                  options.data = options.data.call(this.$element, params);
              }

              function request() {
                  var $request = options.transport(options, function (data) {
                      var results = self.processResults(data, params);

                      if (self.options.get('debug') && window.console && console.error) {
                          // Check to make sure that the response included a `results` key.
                          if (!results || !results.results || !$.isArray(results.results)) {
                              console.error(
                                'Select2: The AJAX results did not return an array in the ' +
                                '`results` key of the response.'
                              );
                          }
                      }

                      callback(results);
                  }, function () {
                      // TODO: Handle AJAX errors
                  });

                  self._request = $request;
              }

              if (this.ajaxOptions.delay && params.term !== '') {
                  if (this._queryTimeout) {
                      window.clearTimeout(this._queryTimeout);
                  }

                  this._queryTimeout = window.setTimeout(request, this.ajaxOptions.delay);
              } else {
                  request();
              }
          };

          return AjaxAdapter;
      });

      S2.define('select2/data/tags', [
        'jquery'
      ], function ($) {
          function Tags(decorated, $element, options) {
              var tags = options.get('tags');

              var createTag = options.get('createTag');

              if (createTag !== undefined) {
                  this.createTag = createTag;
              }

              decorated.call(this, $element, options);

              if ($.isArray(tags)) {
                  for (var t = 0; t < tags.length; t++) {
                      var tag = tags[t];
                      var item = this._normalizeItem(tag);

                      var $option = this.option(item);

                      this.$element.append($option);
                  }
              }
          }

          Tags.prototype.query = function (decorated, params, callback) {
              var self = this;

              this._removeOldTags();

              if (params.term == null || params.page != null) {
                  decorated.call(this, params, callback);
                  return;
              }

              function wrapper(obj, child) {
                  var data = obj.results;

                  for (var i = 0; i < data.length; i++) {
                      var option = data[i];

                      var checkChildren = (
                        option.children != null &&
                        !wrapper({
                            results: option.children
                        }, true)
                      );

                      var checkText = option.text === params.term;

                      if (checkText || checkChildren) {
                          if (child) {
                              return false;
                          }

                          obj.data = data;
                          callback(obj);

                          return;
                      }
                  }

                  if (child) {
                      return true;
                  }

                  var tag = self.createTag(params);

                  if (tag != null) {
                      var $option = self.option(tag);
                      $option.attr('data-select2-tag', true);

                      self.addOptions([$option]);

                      self.insertTag(data, tag);
                  }

                  obj.results = data;

                  callback(obj);
              }

              decorated.call(this, params, wrapper);
          };

          Tags.prototype.createTag = function (decorated, params) {
              var term = $.trim(params.term);

              if (term === '') {
                  return null;
              }

              return {
                  id: term,
                  text: term
              };
          };

          Tags.prototype.insertTag = function (_, data, tag) {
              data.unshift(tag);
          };

          Tags.prototype._removeOldTags = function (_) {
              var tag = this._lastTag;

              var $options = this.$element.find('option[data-select2-tag]');

              $options.each(function () {
                  if (this.selected) {
                      return;
                  }

                  $(this).remove();
              });
          };

          return Tags;
      });

      S2.define('select2/data/tokenizer', [
        'jquery'
      ], function ($) {
          function Tokenizer(decorated, $element, options) {
              var tokenizer = options.get('tokenizer');

              if (tokenizer !== undefined) {
                  this.tokenizer = tokenizer;
              }

              decorated.call(this, $element, options);
          }

          Tokenizer.prototype.bind = function (decorated, container, $container) {
              decorated.call(this, container, $container);

              this.$search = container.dropdown.$search || container.selection.$search ||
                $container.find('.select2-search__field');
          };

          Tokenizer.prototype.query = function (decorated, params, callback) {
              var self = this;

              function select(data) {
                  self.trigger('select', {
                      data: data
                  });
              }

              params.term = params.term || '';

              var tokenData = this.tokenizer(params, this.options, select);

              if (tokenData.term !== params.term) {
                  // Replace the search term if we have the search box
                  if (this.$search.length) {
                      this.$search.val(tokenData.term);
                      this.$search.focus();
                  }

                  params.term = tokenData.term;
              }

              decorated.call(this, params, callback);
          };

          Tokenizer.prototype.tokenizer = function (_, params, options, callback) {
              var separators = options.get('tokenSeparators') || [];
              var term = params.term;
              var i = 0;

              var createTag = this.createTag || function (params) {
                  return {
                      id: params.term,
                      text: params.term
                  };
              };

              while (i < term.length) {
                  var termChar = term[i];

                  if ($.inArray(termChar, separators) === -1) {
                      i++;

                      continue;
                  }

                  var part = term.substr(0, i);
                  var partParams = $.extend({}, params, {
                      term: part
                  });

                  var data = createTag(partParams);

                  if (data == null) {
                      i++;
                      continue;
                  }

                  callback(data);

                  // Reset the term to not include the tokenized portion
                  term = term.substr(i + 1) || '';
                  i = 0;
              }

              return {
                  term: term
              };
          };

          return Tokenizer;
      });

      S2.define('select2/data/minimumInputLength', [

      ], function () {
          function MinimumInputLength(decorated, $e, options) {
              this.minimumInputLength = options.get('minimumInputLength');

              decorated.call(this, $e, options);
          }

          MinimumInputLength.prototype.query = function (decorated, params, callback) {
              params.term = params.term || '';

              if (params.term.length < this.minimumInputLength) {
                  this.trigger('results:message', {
                      message: 'inputTooShort',
                      args: {
                          minimum: this.minimumInputLength,
                          input: params.term,
                          params: params
                      }
                  });

                  return;
              }

              decorated.call(this, params, callback);
          };

          return MinimumInputLength;
      });

      S2.define('select2/data/maximumInputLength', [

      ], function () {
          function MaximumInputLength(decorated, $e, options) {
              this.maximumInputLength = options.get('maximumInputLength');

              decorated.call(this, $e, options);
          }

          MaximumInputLength.prototype.query = function (decorated, params, callback) {
              params.term = params.term || '';

              if (this.maximumInputLength > 0 &&
                  params.term.length > this.maximumInputLength) {
                  this.trigger('results:message', {
                      message: 'inputTooLong',
                      args: {
                          maximum: this.maximumInputLength,
                          input: params.term,
                          params: params
                      }
                  });

                  return;
              }

              decorated.call(this, params, callback);
          };

          return MaximumInputLength;
      });

      S2.define('select2/data/maximumSelectionLength', [

      ], function () {
          function MaximumSelectionLength(decorated, $e, options) {
              this.maximumSelectionLength = options.get('maximumSelectionLength');

              decorated.call(this, $e, options);
          }

          MaximumSelectionLength.prototype.query =
            function (decorated, params, callback) {
                var self = this;

                this.current(function (currentData) {
                    var count = currentData != null ? currentData.length : 0;
                    if (self.maximumSelectionLength > 0 &&
                      count >= self.maximumSelectionLength) {
                        self.trigger('results:message', {
                            message: 'maximumSelected',
                            args: {
                                maximum: self.maximumSelectionLength
                            }
                        });
                        return;
                    }
                    decorated.call(self, params, callback);
                });
            };

          return MaximumSelectionLength;
      });

      S2.define('select2/dropdown', [
        'jquery',
        './utils'
      ], function ($, Utils) {
          function Dropdown($element, options) {
              this.$element = $element;
              this.options = options;

              Dropdown.__super__.constructor.call(this);
          }

          Utils.Extend(Dropdown, Utils.Observable);

          Dropdown.prototype.render = function () {
              var $dropdown = $(
                '<span class="select2-dropdown">' +
                  '<span class="select2-results"></span>' +
                '</span>'
              );

              $dropdown.attr('dir', this.options.get('dir'));

              this.$dropdown = $dropdown;

              return $dropdown;
          };

          Dropdown.prototype.bind = function () {
              // Should be implemented in subclasses
          };

          Dropdown.prototype.position = function ($dropdown, $container) {
              // Should be implmented in subclasses
          };

          Dropdown.prototype.destroy = function () {
              // Remove the dropdown from the DOM
              this.$dropdown.remove();
          };

          return Dropdown;
      });

      S2.define('select2/dropdown/search', [
        'jquery',
        '../utils'
      ], function ($, Utils) {
          function Search() { }

          Search.prototype.render = function (decorated) {
              var $rendered = decorated.call(this);

              var $search = $(
                '<span class="select2-search select2-search--dropdown">' +
                  '<input class="select2-search__field" type="search" tabindex="-1"' +
                  ' autocomplete="off" autocorrect="off" autocapitalize="off"' +
                  ' spellcheck="false" role="textbox" />' +
                '</span>'
              );

              this.$searchContainer = $search;
              this.$search = $search.find('input');

              $rendered.prepend($search);

              return $rendered;
          };

          Search.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              this.$search.on('keydown', function (evt) {
                  self.trigger('keypress', evt);

                  self._keyUpPrevented = evt.isDefaultPrevented();
              });

              // Workaround for browsers which do not support the `input` event
              // This will prevent double-triggering of events for browsers which support
              // both the `keyup` and `input` events.
              this.$search.on('input', function (evt) {
                  // Unbind the duplicated `keyup` event
                  $(this).off('keyup');
              });

              this.$search.on('keyup input', function (evt) {
                  self.handleSearch(evt);
              });

              container.on('open', function () {
                  self.$search.attr('tabindex', 0);

                  self.$search.focus();

                  window.setTimeout(function () {
                      self.$search.focus();
                  }, 0);
              });

              container.on('close', function () {
                  self.$search.attr('tabindex', -1);

                  self.$search.val('');
              });

              container.on('results:all', function (params) {
                  if (params.query.term == null || params.query.term === '') {
                      var showSearch = self.showSearch(params);

                      if (showSearch) {
                          self.$searchContainer.removeClass('select2-search--hide');
                      } else {
                          self.$searchContainer.addClass('select2-search--hide');
                      }
                  }
              });
          };

          Search.prototype.handleSearch = function (evt) {
              if (!this._keyUpPrevented) {
                  var input = this.$search.val();

                  this.trigger('query', {
                      term: input
                  });
              }

              this._keyUpPrevented = false;
          };

          Search.prototype.showSearch = function (_, params) {
              return true;
          };

          return Search;
      });

      S2.define('select2/dropdown/hidePlaceholder', [

      ], function () {
          function HidePlaceholder(decorated, $element, options, dataAdapter) {
              this.placeholder = this.normalizePlaceholder(options.get('placeholder'));

              decorated.call(this, $element, options, dataAdapter);
          }

          HidePlaceholder.prototype.append = function (decorated, data) {
              data.results = this.removePlaceholder(data.results);

              decorated.call(this, data);
          };

          HidePlaceholder.prototype.normalizePlaceholder = function (_, placeholder) {
              if (typeof placeholder === 'string') {
                  placeholder = {
                      id: '',
                      text: placeholder
                  };
              }

              return placeholder;
          };

          HidePlaceholder.prototype.removePlaceholder = function (_, data) {
              var modifiedData = data.slice(0);

              for (var d = data.length - 1; d >= 0; d--) {
                  var item = data[d];

                  if (this.placeholder.id === item.id) {
                      modifiedData.splice(d, 1);
                  }
              }

              return modifiedData;
          };

          return HidePlaceholder;
      });

      S2.define('select2/dropdown/infiniteScroll', [
        'jquery'
      ], function ($) {
          function InfiniteScroll(decorated, $element, options, dataAdapter) {
              this.lastParams = {};

              decorated.call(this, $element, options, dataAdapter);

              this.$loadingMore = this.createLoadingMore();
              this.loading = false;
          }

          InfiniteScroll.prototype.append = function (decorated, data) {
              this.$loadingMore.remove();
              this.loading = false;

              decorated.call(this, data);

              if (this.showLoadingMore(data)) {
                  this.$results.append(this.$loadingMore);
              }
          };

          InfiniteScroll.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              container.on('query', function (params) {
                  self.lastParams = params;
                  self.loading = true;
              });

              container.on('query:append', function (params) {
                  self.lastParams = params;
                  self.loading = true;
              });

              this.$results.on('scroll', function () {
                  var isLoadMoreVisible = $.contains(
                    document.documentElement,
                    self.$loadingMore[0]
                  );

                  if (self.loading || !isLoadMoreVisible) {
                      return;
                  }

                  var currentOffset = self.$results.offset().top +
                    self.$results.outerHeight(false);
                  var loadingMoreOffset = self.$loadingMore.offset().top +
                    self.$loadingMore.outerHeight(false);

                  if (currentOffset + 50 >= loadingMoreOffset) {
                      self.loadMore();
                  }
              });
          };

          InfiniteScroll.prototype.loadMore = function () {
              this.loading = true;

              var params = $.extend({}, { page: 1 }, this.lastParams);

              params.page++;

              this.trigger('query:append', params);
          };

          InfiniteScroll.prototype.showLoadingMore = function (_, data) {
              return data.pagination && data.pagination.more;
          };

          InfiniteScroll.prototype.createLoadingMore = function () {
              var $option = $(
                '<li ' +
                'class="select2-results__option select2-results__option--load-more"' +
                'role="treeitem" aria-disabled="true"></li>'
              );

              var message = this.options.get('translations').get('loadingMore');

              $option.html(message(this.lastParams));

              return $option;
          };

          return InfiniteScroll;
      });

      S2.define('select2/dropdown/attachBody', [
        'jquery',
        '../utils'
      ], function ($, Utils) {
          function AttachBody(decorated, $element, options) {
              this.$dropdownParent = options.get('dropdownParent') || $(document.body);

              decorated.call(this, $element, options);
          }

          AttachBody.prototype.bind = function (decorated, container, $container) {
              var self = this;

              var setupResultsEvents = false;

              decorated.call(this, container, $container);

              container.on('open', function () {
                  self._showDropdown();
                  self._attachPositioningHandler(container);

                  if (!setupResultsEvents) {
                      setupResultsEvents = true;

                      container.on('results:all', function () {
                          self._positionDropdown();
                          self._resizeDropdown();
                      });

                      container.on('results:append', function () {
                          self._positionDropdown();
                          self._resizeDropdown();
                      });
                  }
              });

              container.on('close', function () {
                  self._hideDropdown();
                  self._detachPositioningHandler(container);
              });

              this.$dropdownContainer.on('mousedown', function (evt) {
                  evt.stopPropagation();
              });
          };

          AttachBody.prototype.destroy = function (decorated) {
              decorated.call(this);

              this.$dropdownContainer.remove();
          };

          AttachBody.prototype.position = function (decorated, $dropdown, $container) {
              // Clone all of the container classes
              $dropdown.attr('class', $container.attr('class'));

              $dropdown.removeClass('select2');
              $dropdown.addClass('select2-container--open');

              $dropdown.css({
                  position: 'absolute',
                  top: -999999
              });

              this.$container = $container;
          };

          AttachBody.prototype.render = function (decorated) {
              var $container = $('<span></span>');

              var $dropdown = decorated.call(this);
              $container.append($dropdown);

              this.$dropdownContainer = $container;

              return $container;
          };

          AttachBody.prototype._hideDropdown = function (decorated) {
              this.$dropdownContainer.detach();
          };

          AttachBody.prototype._attachPositioningHandler =
              function (decorated, container) {
                  var self = this;

                  var scrollEvent = 'scroll.select2.' + container.id;
                  var resizeEvent = 'resize.select2.' + container.id;
                  var orientationEvent = 'orientationchange.select2.' + container.id;

                  var $watchers = this.$container.parents().filter(Utils.hasScroll);
                  $watchers.each(function () {
                      $(this).data('select2-scroll-position', {
                          x: $(this).scrollLeft(),
                          y: $(this).scrollTop()
                      });
                  });

                  $watchers.on(scrollEvent, function (ev) {
                      var position = $(this).data('select2-scroll-position');
                      $(this).scrollTop(position.y);
                  });

                  $(window).on(scrollEvent + ' ' + resizeEvent + ' ' + orientationEvent,
                    function (e) {
                        self._positionDropdown();
                        self._resizeDropdown();
                    });
              };

          AttachBody.prototype._detachPositioningHandler =
              function (decorated, container) {
                  var scrollEvent = 'scroll.select2.' + container.id;
                  var resizeEvent = 'resize.select2.' + container.id;
                  var orientationEvent = 'orientationchange.select2.' + container.id;

                  var $watchers = this.$container.parents().filter(Utils.hasScroll);
                  $watchers.off(scrollEvent);

                  $(window).off(scrollEvent + ' ' + resizeEvent + ' ' + orientationEvent);
              };

          AttachBody.prototype._positionDropdown = function () {
              var $window = $(window);

              var isCurrentlyAbove = this.$dropdown.hasClass('select2-dropdown--above');
              var isCurrentlyBelow = this.$dropdown.hasClass('select2-dropdown--below');

              var newDirection = null;

              var position = this.$container.position();
              var offset = this.$container.offset();

              offset.bottom = offset.top + this.$container.outerHeight(false);

              var container = {
                  height: this.$container.outerHeight(false)
              };

              container.top = offset.top;
              container.bottom = offset.top + container.height;

              var dropdown = {
                  height: this.$dropdown.outerHeight(false)
              };

              var viewport = {
                  top: $window.scrollTop(),
                  bottom: $window.scrollTop() + $window.height()
              };

              var enoughRoomAbove = viewport.top < (offset.top - dropdown.height);
              var enoughRoomBelow = viewport.bottom > (offset.bottom + dropdown.height);

              var css = {
                  left: offset.left,
                  top: container.bottom
              };

              // Fix positioning with static parents
              if (this.$dropdownParent[0].style.position !== 'static') {
                  var parentOffset = this.$dropdownParent.offset();

                  css.top -= parentOffset.top;
                  css.left -= parentOffset.left;
              }

              if (!isCurrentlyAbove && !isCurrentlyBelow) {
                  newDirection = 'below';
              }

              if (!enoughRoomBelow && enoughRoomAbove && !isCurrentlyAbove) {
                  newDirection = 'above';
              } else if (!enoughRoomAbove && enoughRoomBelow && isCurrentlyAbove) {
                  newDirection = 'below';
              }

              if (newDirection == 'above' ||
                (isCurrentlyAbove && newDirection !== 'below')) {
                  css.top = container.top - dropdown.height;
              }

              if (newDirection != null) {
                  this.$dropdown
                    .removeClass('select2-dropdown--below select2-dropdown--above')
                    .addClass('select2-dropdown--' + newDirection);
                  this.$container
                    .removeClass('select2-container--below select2-container--above')
                    .addClass('select2-container--' + newDirection);
              }

              this.$dropdownContainer.css(css);
          };

          AttachBody.prototype._resizeDropdown = function () {
              var css = {
                  width: this.$container.outerWidth(false) + 'px'
              };

              if (this.options.get('dropdownAutoWidth')) {
                  css.minWidth = css.width;
                  css.width = 'auto';
              }

              this.$dropdown.css(css);
          };

          AttachBody.prototype._showDropdown = function (decorated) {
              this.$dropdownContainer.appendTo(this.$dropdownParent);

              this._positionDropdown();
              this._resizeDropdown();
          };

          return AttachBody;
      });

      S2.define('select2/dropdown/minimumResultsForSearch', [

      ], function () {
          function countResults(data) {
              var count = 0;

              for (var d = 0; d < data.length; d++) {
                  var item = data[d];

                  if (item.children) {
                      count += countResults(item.children);
                  } else {
                      count++;
                  }
              }

              return count;
          }

          function MinimumResultsForSearch(decorated, $element, options, dataAdapter) {
              this.minimumResultsForSearch = options.get('minimumResultsForSearch');

              if (this.minimumResultsForSearch < 0) {
                  this.minimumResultsForSearch = Infinity;
              }

              decorated.call(this, $element, options, dataAdapter);
          }

          MinimumResultsForSearch.prototype.showSearch = function (decorated, params) {
              if (countResults(params.data.results) < this.minimumResultsForSearch) {
                  return false;
              }

              return decorated.call(this, params);
          };

          return MinimumResultsForSearch;
      });

      S2.define('select2/dropdown/selectOnClose', [

      ], function () {
          function SelectOnClose() { }

          SelectOnClose.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              container.on('close', function () {
                  self._handleSelectOnClose();
              });
          };

          SelectOnClose.prototype._handleSelectOnClose = function () {
              var $highlightedResults = this.getHighlightedResults();

              // Only select highlighted results
              if ($highlightedResults.length < 1) {
                  return;
              }

              var data = $highlightedResults.data('data');

              // Don't re-select already selected resulte
              if (
                (data.element != null && data.element.selected) ||
                (data.element == null && data.selected)
              ) {
                  return;
              }

              this.trigger('select', {
                  data: data
              });
          };

          return SelectOnClose;
      });

      S2.define('select2/dropdown/closeOnSelect', [

      ], function () {
          function CloseOnSelect() { }

          CloseOnSelect.prototype.bind = function (decorated, container, $container) {
              var self = this;

              decorated.call(this, container, $container);

              container.on('select', function (evt) {
                  self._selectTriggered(evt);
              });

              container.on('unselect', function (evt) {
                  self._selectTriggered(evt);
              });
          };

          CloseOnSelect.prototype._selectTriggered = function (_, evt) {
              var originalEvent = evt.originalEvent;

              // Don't close if the control key is being held
              if (originalEvent && originalEvent.ctrlKey) {
                  return;
              }

              this.trigger('close', {});
          };

          return CloseOnSelect;
      });

      S2.define('select2/i18n/en', [], function () {
          // English
          return {
              errorLoading: function () {
                  return 'The results could not be loaded.';
              },
              inputTooLong: function (args) {
                  var overChars = args.input.length - args.maximum;

                  var message = 'Please delete ' + overChars + ' character';

                  if (overChars != 1) {
                      message += 's';
                  }

                  return message;
              },
              inputTooShort: function (args) {
                  var remainingChars = args.minimum - args.input.length;

                  var message = 'Please enter ' + remainingChars + ' or more characters';

                  return message;
              },
              loadingMore: function () {
                  return 'Loading more results�';
              },
              maximumSelected: function (args) {
                  var message = 'You can only select ' + args.maximum + ' item';

                  if (args.maximum != 1) {
                      message += 's';
                  }

                  return message;
              },
              noResults: function () {
                  return 'No results found';
              },
              searching: function () {
                  return 'Searching�';
              }
          };
      });

      S2.define('select2/defaults', [
        'jquery',
        'require',

        './results',

        './selection/single',
        './selection/multiple',
        './selection/placeholder',
        './selection/allowClear',
        './selection/search',
        './selection/eventRelay',

        './utils',
        './translation',
        './diacritics',

        './data/select',
        './data/array',
        './data/ajax',
        './data/tags',
        './data/tokenizer',
        './data/minimumInputLength',
        './data/maximumInputLength',
        './data/maximumSelectionLength',

        './dropdown',
        './dropdown/search',
        './dropdown/hidePlaceholder',
        './dropdown/infiniteScroll',
        './dropdown/attachBody',
        './dropdown/minimumResultsForSearch',
        './dropdown/selectOnClose',
        './dropdown/closeOnSelect',

        './i18n/en'
      ], function ($, require,

                   ResultsList,

                   SingleSelection, MultipleSelection, Placeholder, AllowClear,
                   SelectionSearch, EventRelay,

                   Utils, Translation, DIACRITICS,

                   SelectData, ArrayData, AjaxData, Tags, Tokenizer,
                   MinimumInputLength, MaximumInputLength, MaximumSelectionLength,

                   Dropdown, DropdownSearch, HidePlaceholder, InfiniteScroll,
                   AttachBody, MinimumResultsForSearch, SelectOnClose, CloseOnSelect,

                   EnglishTranslation) {
          function Defaults() {
              this.reset();
          }

          Defaults.prototype.apply = function (options) {
              options = $.extend({}, this.defaults, options);

              if (options.dataAdapter == null) {
                  if (options.ajax != null) {
                      options.dataAdapter = AjaxData;
                  } else if (options.data != null) {
                      options.dataAdapter = ArrayData;
                  } else {
                      options.dataAdapter = SelectData;
                  }

                  if (options.minimumInputLength > 0) {
                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        MinimumInputLength
                      );
                  }

                  if (options.maximumInputLength > 0) {
                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        MaximumInputLength
                      );
                  }

                  if (options.maximumSelectionLength > 0) {
                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        MaximumSelectionLength
                      );
                  }

                  if (options.tags) {
                      options.dataAdapter = Utils.Decorate(options.dataAdapter, Tags);
                  }

                  if (options.tokenSeparators != null || options.tokenizer != null) {
                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        Tokenizer
                      );
                  }

                  if (options.query != null) {
                      var Query = require(options.amdBase + 'compat/query');

                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        Query
                      );
                  }

                  if (options.initSelection != null) {
                      var InitSelection = require(options.amdBase + 'compat/initSelection');

                      options.dataAdapter = Utils.Decorate(
                        options.dataAdapter,
                        InitSelection
                      );
                  }
              }

              if (options.resultsAdapter == null) {
                  options.resultsAdapter = ResultsList;

                  if (options.ajax != null) {
                      options.resultsAdapter = Utils.Decorate(
                        options.resultsAdapter,
                        InfiniteScroll
                      );
                  }

                  if (options.placeholder != null) {
                      options.resultsAdapter = Utils.Decorate(
                        options.resultsAdapter,
                        HidePlaceholder
                      );
                  }

                  if (options.selectOnClose) {
                      options.resultsAdapter = Utils.Decorate(
                        options.resultsAdapter,
                        SelectOnClose
                      );
                  }
              }

              if (options.dropdownAdapter == null) {
                  if (options.multiple) {
                      options.dropdownAdapter = Dropdown;
                  } else {
                      var SearchableDropdown = Utils.Decorate(Dropdown, DropdownSearch);

                      options.dropdownAdapter = SearchableDropdown;
                  }

                  if (options.minimumResultsForSearch !== 0) {
                      options.dropdownAdapter = Utils.Decorate(
                        options.dropdownAdapter,
                        MinimumResultsForSearch
                      );
                  }

                  if (options.closeOnSelect) {
                      options.dropdownAdapter = Utils.Decorate(
                        options.dropdownAdapter,
                        CloseOnSelect
                      );
                  }

                  if (
                    options.dropdownCssClass != null ||
                    options.dropdownCss != null ||
                    options.adaptDropdownCssClass != null
                  ) {
                      var DropdownCSS = require(options.amdBase + 'compat/dropdownCss');

                      options.dropdownAdapter = Utils.Decorate(
                        options.dropdownAdapter,
                        DropdownCSS
                      );
                  }

                  options.dropdownAdapter = Utils.Decorate(
                    options.dropdownAdapter,
                    AttachBody
                  );
              }

              if (options.selectionAdapter == null) {
                  if (options.multiple) {
                      options.selectionAdapter = MultipleSelection;
                  } else {
                      options.selectionAdapter = SingleSelection;
                  }

                  // Add the placeholder mixin if a placeholder was specified
                  if (options.placeholder != null) {
                      options.selectionAdapter = Utils.Decorate(
                        options.selectionAdapter,
                        Placeholder
                      );
                  }

                  if (options.allowClear) {
                      options.selectionAdapter = Utils.Decorate(
                        options.selectionAdapter,
                        AllowClear
                      );
                  }

                  if (options.multiple) {
                      options.selectionAdapter = Utils.Decorate(
                        options.selectionAdapter,
                        SelectionSearch
                      );
                  }

                  if (
                    options.containerCssClass != null ||
                    options.containerCss != null ||
                    options.adaptContainerCssClass != null
                  ) {
                      var ContainerCSS = require(options.amdBase + 'compat/containerCss');

                      options.selectionAdapter = Utils.Decorate(
                        options.selectionAdapter,
                        ContainerCSS
                      );
                  }

                  options.selectionAdapter = Utils.Decorate(
                    options.selectionAdapter,
                    EventRelay
                  );
              }

              if (typeof options.language === 'string') {
                  // Check if the language is specified with a region
                  if (options.language.indexOf('-') > 0) {
                      // Extract the region information if it is included
                      var languageParts = options.language.split('-');
                      var baseLanguage = languageParts[0];

                      options.language = [options.language, baseLanguage];
                  } else {
                      options.language = [options.language];
                  }
              }

              if ($.isArray(options.language)) {
                  var languages = new Translation();
                  options.language.push('en');

                  var languageNames = options.language;

                  for (var l = 0; l < languageNames.length; l++) {
                      var name = languageNames[l];
                      var language = {};

                      try {
                          // Try to load it with the original name
                          language = Translation.loadPath(name);
                      } catch (e) {
                          try {
                              // If we couldn't load it, check if it wasn't the full path
                              name = this.defaults.amdLanguageBase + name;
                              language = Translation.loadPath(name);
                          } catch (ex) {
                              // The translation could not be loaded at all. Sometimes this is
                              // because of a configuration problem, other times this can be
                              // because of how Select2 helps load all possible translation files.
                              if (options.debug && window.console && console.warn) {
                                  console.warn(
                                    'Select2: The language file for "' + name + '" could not be ' +
                                    'automatically loaded. A fallback will be used instead.'
                                  );
                              }

                              continue;
                          }
                      }

                      languages.extend(language);
                  }

                  options.translations = languages;
              } else {
                  var baseTranslation = Translation.loadPath(
                    this.defaults.amdLanguageBase + 'en'
                  );
                  var customTranslation = new Translation(options.language);

                  customTranslation.extend(baseTranslation);

                  options.translations = customTranslation;
              }

              return options;
          };

          Defaults.prototype.reset = function () {
              function stripDiacritics(text) {
                  // Used 'uni range + named function' from http://jsperf.com/diacritics/18
                  function match(a) {
                      return DIACRITICS[a] || a;
                  }

                  return text.replace(/[^\u0000-\u007E]/g, match);
              }

              function matcher(params, data) {
                  // Always return the object if there is nothing to compare
                  if ($.trim(params.term) === '') {
                      return data;
                  }

                  // Do a recursive check for options with children
                  if (data.children && data.children.length > 0) {
                      // Clone the data object if there are children
                      // This is required as we modify the object to remove any non-matches
                      var match = $.extend(true, {}, data);

                      // Check each child of the option
                      for (var c = data.children.length - 1; c >= 0; c--) {
                          var child = data.children[c];

                          var matches = matcher(params, child);

                          // If there wasn't a match, remove the object in the array
                          if (matches == null) {
                              match.children.splice(c, 1);
                          }
                      }

                      // If any children matched, return the new object
                      if (match.children.length > 0) {
                          return match;
                      }

                      // If there were no matching children, check just the plain object
                      return matcher(params, match);
                  }

                  var original = stripDiacritics(data.text).toUpperCase();
                  var term = stripDiacritics(params.term).toUpperCase();

                  // Check if the text contains the term
                  if (original.indexOf(term) > -1) {
                      return data;
                  }

                  // If it doesn't contain the term, don't return anything
                  return null;
              }

              this.defaults = {
                  amdBase: './',
                  amdLanguageBase: './i18n/',
                  closeOnSelect: true,
                  debug: false,
                  dropdownAutoWidth: false,
                  escapeMarkup: Utils.escapeMarkup,
                  language: EnglishTranslation,
                  matcher: matcher,
                  minimumInputLength: 0,
                  maximumInputLength: 0,
                  maximumSelectionLength: 0,
                  minimumResultsForSearch: 0,
                  selectOnClose: false,
                  sorter: function (data) {
                      return data;
                  },
                  templateResult: function (result) {
                      return result.text;
                  },
                  templateSelection: function (selection) {
                      return selection.text;
                  },
                  theme: 'default',
                  width: 'resolve'
              };
          };

          Defaults.prototype.set = function (key, value) {
              var camelKey = $.camelCase(key);

              var data = {};
              data[camelKey] = value;

              var convertedData = Utils._convertData(data);

              $.extend(this.defaults, convertedData);
          };

          var defaults = new Defaults();

          return defaults;
      });

      S2.define('select2/options', [
        'require',
        'jquery',
        './defaults',
        './utils'
      ], function (require, $, Defaults, Utils) {
          function Options(options, $element) {
              this.options = options;

              if ($element != null) {
                  this.fromElement($element);
              }

              this.options = Defaults.apply(this.options);

              if ($element && $element.is('input')) {
                  var InputCompat = require(this.get('amdBase') + 'compat/inputData');

                  this.options.dataAdapter = Utils.Decorate(
                    this.options.dataAdapter,
                    InputCompat
                  );
              }
          }

          Options.prototype.fromElement = function ($e) {
              var excludedData = ['select2'];

              if (this.options.multiple == null) {
                  this.options.multiple = $e.prop('multiple');
              }

              if (this.options.disabled == null) {
                  this.options.disabled = $e.prop('disabled');
              }

              if (this.options.language == null) {
                  if ($e.prop('lang')) {
                      this.options.language = $e.prop('lang').toLowerCase();
                  } else if ($e.closest('[lang]').prop('lang')) {
                      this.options.language = $e.closest('[lang]').prop('lang');
                  }
              }

              if (this.options.dir == null) {
                  if ($e.prop('dir')) {
                      this.options.dir = $e.prop('dir');
                  } else if ($e.closest('[dir]').prop('dir')) {
                      this.options.dir = $e.closest('[dir]').prop('dir');
                  } else {
                      this.options.dir = 'ltr';
                  }
              }

              $e.prop('disabled', this.options.disabled);
              $e.prop('multiple', this.options.multiple);

              if ($e.data('select2Tags')) {
                  if (this.options.debug && window.console && console.warn) {
                      console.warn(
                        'Select2: The `data-select2-tags` attribute has been changed to ' +
                        'use the `data-data` and `data-tags="true"` attributes and will be ' +
                        'removed in future versions of Select2.'
                      );
                  }

                  $e.data('data', $e.data('select2Tags'));
                  $e.data('tags', true);
              }

              if ($e.data('ajaxUrl')) {
                  if (this.options.debug && window.console && console.warn) {
                      console.warn(
                        'Select2: The `data-ajax-url` attribute has been changed to ' +
                        '`data-ajax--url` and support for the old attribute will be removed' +
                        ' in future versions of Select2.'
                      );
                  }

                  $e.attr('ajax--url', $e.data('ajaxUrl'));
                  $e.data('ajax--url', $e.data('ajaxUrl'));
              }

              var dataset = {};

              // Prefer the element's `dataset` attribute if it exists
              // jQuery 1.x does not correctly handle data attributes with multiple dashes
              if ($.fn.jquery && $.fn.jquery.substr(0, 2) == '1.' && $e[0].dataset) {
                  dataset = $.extend(true, {}, $e[0].dataset, $e.data());
              } else {
                  dataset = $e.data();
              }

              var data = $.extend(true, {}, dataset);

              data = Utils._convertData(data);

              for (var key in data) {
                  if ($.inArray(key, excludedData) > -1) {
                      continue;
                  }

                  if ($.isPlainObject(this.options[key])) {
                      $.extend(this.options[key], data[key]);
                  } else {
                      this.options[key] = data[key];
                  }
              }

              return this;
          };

          Options.prototype.get = function (key) {
              return this.options[key];
          };

          Options.prototype.set = function (key, val) {
              this.options[key] = val;
          };

          return Options;
      });

      S2.define('select2/core', [
        'jquery',
        './options',
        './utils',
        './keys'
      ], function ($, Options, Utils, KEYS) {
          var Select2 = function ($element, options) {
              if ($element.data('select2') != null) {
                  $element.data('select2').destroy();
              }

              this.$element = $element;

              this.id = this._generateId($element);

              options = options || {};

              this.options = new Options(options, $element);

              Select2.__super__.constructor.call(this);

              // Set up the tabindex

              var tabindex = $element.attr('tabindex') || 0;
              $element.data('old-tabindex', tabindex);
              $element.attr('tabindex', '-1');

              // Set up containers and adapters

              var DataAdapter = this.options.get('dataAdapter');
              this.dataAdapter = new DataAdapter($element, this.options);

              var $container = this.render();

              this._placeContainer($container);

              var SelectionAdapter = this.options.get('selectionAdapter');
              this.selection = new SelectionAdapter($element, this.options);
              this.$selection = this.selection.render();

              this.selection.position(this.$selection, $container);

              var DropdownAdapter = this.options.get('dropdownAdapter');
              this.dropdown = new DropdownAdapter($element, this.options);
              this.$dropdown = this.dropdown.render();

              this.dropdown.position(this.$dropdown, $container);

              var ResultsAdapter = this.options.get('resultsAdapter');
              this.results = new ResultsAdapter($element, this.options, this.dataAdapter);
              this.$results = this.results.render();

              this.results.position(this.$results, this.$dropdown);

              // Bind events

              var self = this;

              // Bind the container to all of the adapters
              this._bindAdapters();

              // Register any DOM event handlers
              this._registerDomEvents();

              // Register any internal event handlers
              this._registerDataEvents();
              this._registerSelectionEvents();
              this._registerDropdownEvents();
              this._registerResultsEvents();
              this._registerEvents();

              // Set the initial state
              this.dataAdapter.current(function (initialData) {
                  self.trigger('selection:update', {
                      data: initialData
                  });
              });

              // Hide the original select
              $element.addClass('select2-hidden-accessible');
              $element.attr('aria-hidden', 'true');

              // Synchronize any monitored attributes
              this._syncAttributes();

              $element.data('select2', this);
          };

          Utils.Extend(Select2, Utils.Observable);

          Select2.prototype._generateId = function ($element) {
              var id = '';

              if ($element.attr('id') != null) {
                  id = $element.attr('id');
              } else if ($element.attr('name') != null) {
                  id = $element.attr('name') + '-' + Utils.generateChars(2);
              } else {
                  id = Utils.generateChars(4);
              }

              id = 'select2-' + id;

              return id;
          };

          Select2.prototype._placeContainer = function ($container) {
              $container.insertAfter(this.$element);

              var width = this._resolveWidth(this.$element, this.options.get('width'));

              if (width != null) {
                  $container.css('width', width);
              }
          };

          Select2.prototype._resolveWidth = function ($element, method) {
              var WIDTH = /^width:(([-+]?([0-9]*\.)?[0-9]+)(px|em|ex|%|in|cm|mm|pt|pc))/i;

              if (method == 'resolve') {
                  var styleWidth = this._resolveWidth($element, 'style');

                  if (styleWidth != null) {
                      return styleWidth;
                  }

                  return this._resolveWidth($element, 'element');
              }

              if (method == 'element') {
                  var elementWidth = $element.outerWidth(false);

                  if (elementWidth <= 0) {
                      return 'auto';
                  }

                  return elementWidth + 'px';
              }

              if (method == 'style') {
                  var style = $element.attr('style');

                  if (typeof (style) !== 'string') {
                      return null;
                  }

                  var attrs = style.split(';');

                  for (var i = 0, l = attrs.length; i < l; i = i + 1) {
                      var attr = attrs[i].replace(/\s/g, '');
                      var matches = attr.match(WIDTH);

                      if (matches !== null && matches.length >= 1) {
                          return matches[1];
                      }
                  }

                  return null;
              }

              return method;
          };

          Select2.prototype._bindAdapters = function () {
              this.dataAdapter.bind(this, this.$container);
              this.selection.bind(this, this.$container);

              this.dropdown.bind(this, this.$container);
              this.results.bind(this, this.$container);
          };

          Select2.prototype._registerDomEvents = function () {
              var self = this;

              this.$element.on('change.select2', function () {
                  self.dataAdapter.current(function (data) {
                      self.trigger('selection:update', {
                          data: data
                      });
                  });
              });

              this._sync = Utils.bind(this._syncAttributes, this);

              if (this.$element[0].attachEvent) {
                  this.$element[0].attachEvent('onpropertychange', this._sync);
              }

              var observer = window.MutationObserver ||
                window.WebKitMutationObserver ||
                window.MozMutationObserver
              ;

              if (observer != null) {
                  this._observer = new observer(function (mutations) {
                      $.each(mutations, self._sync);
                  });
                  this._observer.observe(this.$element[0], {
                      attributes: true,
                      subtree: false
                  });
              } else if (this.$element[0].addEventListener) {
                  this.$element[0].addEventListener('DOMAttrModified', self._sync, false);
              }
          };

          Select2.prototype._registerDataEvents = function () {
              var self = this;

              this.dataAdapter.on('*', function (name, params) {
                  self.trigger(name, params);
              });
          };

          Select2.prototype._registerSelectionEvents = function () {
              var self = this;
              var nonRelayEvents = ['toggle', 'focus'];

              this.selection.on('toggle', function () {
                  self.toggleDropdown();
              });

              this.selection.on('focus', function (params) {
                  self.focus(params);
              });

              this.selection.on('*', function (name, params) {
                  if ($.inArray(name, nonRelayEvents) !== -1) {
                      return;
                  }

                  self.trigger(name, params);
              });
          };

          Select2.prototype._registerDropdownEvents = function () {
              var self = this;

              this.dropdown.on('*', function (name, params) {
                  self.trigger(name, params);
              });
          };

          Select2.prototype._registerResultsEvents = function () {
              var self = this;

              this.results.on('*', function (name, params) {
                  self.trigger(name, params);
              });
          };

          Select2.prototype._registerEvents = function () {
              var self = this;

              this.on('open', function () {
                  self.$container.addClass('select2-container--open');
              });

              this.on('close', function () {
                  self.$container.removeClass('select2-container--open');
              });

              this.on('enable', function () {
                  self.$container.removeClass('select2-container--disabled');
              });

              this.on('disable', function () {
                  self.$container.addClass('select2-container--disabled');
              });

              this.on('blur', function () {
                  self.$container.removeClass('select2-container--focus');
              });

              this.on('query', function (params) {
                  if (!self.isOpen()) {
                      self.trigger('open', {});
                  }

                  this.dataAdapter.query(params, function (data) {
                      self.trigger('results:all', {
                          data: data,
                          query: params
                      });
                  });
              });

              this.on('query:append', function (params) {
                  this.dataAdapter.query(params, function (data) {
                      self.trigger('results:append', {
                          data: data,
                          query: params
                      });
                  });
              });

              this.on('keypress', function (evt) {
                  var key = evt.which;

                  if (self.isOpen()) {
                      if (key === KEYS.ESC || key === KEYS.TAB ||
                          (key === KEYS.UP && evt.altKey)) {
                          self.close();

                          evt.preventDefault();
                      } else if (key === KEYS.ENTER) {
                          self.trigger('results:select', {});

                          evt.preventDefault();
                      } else if ((key === KEYS.SPACE && evt.ctrlKey)) {
                          self.trigger('results:toggle', {});

                          evt.preventDefault();
                      } else if (key === KEYS.UP) {
                          self.trigger('results:previous', {});

                          evt.preventDefault();
                      } else if (key === KEYS.DOWN) {
                          self.trigger('results:next', {});

                          evt.preventDefault();
                      }
                  } else {
                      if (key === KEYS.ENTER || key === KEYS.SPACE ||
                          (key === KEYS.DOWN && evt.altKey)) {
                          self.open();

                          evt.preventDefault();
                      }
                  }
              });
          };

          Select2.prototype._syncAttributes = function () {
              this.options.set('disabled', this.$element.prop('disabled'));

              if (this.options.get('disabled')) {
                  if (this.isOpen()) {
                      this.close();
                  }

                  this.trigger('disable', {});
              } else {
                  this.trigger('enable', {});
              }
          };

          /**
           * Override the trigger method to automatically trigger pre-events when
           * there are events that can be prevented.
           */
          Select2.prototype.trigger = function (name, args) {
              var actualTrigger = Select2.__super__.trigger;
              var preTriggerMap = {
                  'open': 'opening',
                  'close': 'closing',
                  'select': 'selecting',
                  'unselect': 'unselecting'
              };

              if (args === undefined) {
                  args = {};
              }

              if (name in preTriggerMap) {
                  var preTriggerName = preTriggerMap[name];
                  var preTriggerArgs = {
                      prevented: false,
                      name: name,
                      args: args
                  };

                  actualTrigger.call(this, preTriggerName, preTriggerArgs);

                  if (preTriggerArgs.prevented) {
                      args.prevented = true;

                      return;
                  }
              }

              actualTrigger.call(this, name, args);
          };

          Select2.prototype.toggleDropdown = function () {
              if (this.options.get('disabled')) {
                  return;
              }

              if (this.isOpen()) {
                  this.close();
              } else {
                  this.open();
              }
          };

          Select2.prototype.open = function () {
              if (this.isOpen()) {
                  return;
              }

              this.trigger('query', {});
          };

          Select2.prototype.close = function () {
              if (!this.isOpen()) {
                  return;
              }

              this.trigger('close', {});
          };

          Select2.prototype.isOpen = function () {
              return this.$container.hasClass('select2-container--open');
          };

          Select2.prototype.hasFocus = function () {
              return this.$container.hasClass('select2-container--focus');
          };

          Select2.prototype.focus = function (data) {
              // No need to re-trigger focus events if we are already focused
              if (this.hasFocus()) {
                  return;
              }

              this.$container.addClass('select2-container--focus');
              this.trigger('focus', {});
          };

          Select2.prototype.enable = function (args) {
              if (this.options.get('debug') && window.console && console.warn) {
                  console.warn(
                    'Select2: The `select2("enable")` method has been deprecated and will' +
                    ' be removed in later Select2 versions. Use $element.prop("disabled")' +
                    ' instead.'
                  );
              }

              if (args == null || args.length === 0) {
                  args = [true];
              }

              var disabled = !args[0];

              this.$element.prop('disabled', disabled);
          };

          Select2.prototype.data = function () {
              if (this.options.get('debug') &&
                  arguments.length > 0 && window.console && console.warn) {
                  console.warn(
                    'Select2: Data can no longer be set using `select2("data")`. You ' +
                    'should consider setting the value instead using `$element.val()`.'
                  );
              }

              var data = [];

              this.dataAdapter.current(function (currentData) {
                  data = currentData;
              });

              return data;
          };

          Select2.prototype.val = function (args) {
              if (this.options.get('debug') && window.console && console.warn) {
                  console.warn(
                    'Select2: The `select2("val")` method has been deprecated and will be' +
                    ' removed in later Select2 versions. Use $element.val() instead.'
                  );
              }

              if (args == null || args.length === 0) {
                  return this.$element.val();
              }

              var newVal = args[0];

              if ($.isArray(newVal)) {
                  newVal = $.map(newVal, function (obj) {
                      return obj.toString();
                  });
              }

              this.$element.val(newVal).trigger('change');
          };

          Select2.prototype.destroy = function () {
              this.$container.remove();

              if (this.$element[0].detachEvent) {
                  this.$element[0].detachEvent('onpropertychange', this._sync);
              }

              if (this._observer != null) {
                  this._observer.disconnect();
                  this._observer = null;
              } else if (this.$element[0].removeEventListener) {
                  this.$element[0]
                    .removeEventListener('DOMAttrModified', this._sync, false);
              }

              this._sync = null;

              this.$element.off('.select2');
              this.$element.attr('tabindex', this.$element.data('old-tabindex'));

              this.$element.removeClass('select2-hidden-accessible');
              this.$element.attr('aria-hidden', 'false');
              this.$element.removeData('select2');

              this.dataAdapter.destroy();
              this.selection.destroy();
              this.dropdown.destroy();
              this.results.destroy();

              this.dataAdapter = null;
              this.selection = null;
              this.dropdown = null;
              this.results = null;
          };

          Select2.prototype.render = function () {
              var $container = $(
                '<span class="select2 select2-container">' +
                  '<span class="selection"></span>' +
                  '<span class="dropdown-wrapper" aria-hidden="true"></span>' +
                '</span>'
              );

              $container.attr('dir', this.options.get('dir'));

              this.$container = $container;

              this.$container.addClass('select2-container--' + this.options.get('theme'));

              $container.data('element', this.$element);

              return $container;
          };

          return Select2;
      });

      S2.define('select2/compat/utils', [
        'jquery'
      ], function ($) {
          function syncCssClasses($dest, $src, adapter) {
              var classes, replacements = [], adapted;

              classes = $.trim($dest.attr('class'));

              if (classes) {
                  classes = '' + classes; // for IE which returns object

                  $(classes.split(/\s+/)).each(function () {
                      // Save all Select2 classes
                      if (this.indexOf('select2-') === 0) {
                          replacements.push(this);
                      }
                  });
              }

              classes = $.trim($src.attr('class'));

              if (classes) {
                  classes = '' + classes; // for IE which returns object

                  $(classes.split(/\s+/)).each(function () {
                      // Only adapt non-Select2 classes
                      if (this.indexOf('select2-') !== 0) {
                          adapted = adapter(this);

                          if (adapted != null) {
                              replacements.push(adapted);
                          }
                      }
                  });
              }

              $dest.attr('class', replacements.join(' '));
          }

          return {
              syncCssClasses: syncCssClasses
          };
      });

      S2.define('select2/compat/containerCss', [
        'jquery',
        './utils'
      ], function ($, CompatUtils) {
          // No-op CSS adapter that discards all classes by default
          function _containerAdapter(clazz) {
              return null;
          }

          function ContainerCSS() { }

          ContainerCSS.prototype.render = function (decorated) {
              var $container = decorated.call(this);

              var containerCssClass = this.options.get('containerCssClass') || '';

              if ($.isFunction(containerCssClass)) {
                  containerCssClass = containerCssClass(this.$element);
              }

              var containerCssAdapter = this.options.get('adaptContainerCssClass');
              containerCssAdapter = containerCssAdapter || _containerAdapter;

              if (containerCssClass.indexOf(':all:') !== -1) {
                  containerCssClass = containerCssClass.replace(':all:', '');

                  var _cssAdapter = containerCssAdapter;

                  containerCssAdapter = function (clazz) {
                      var adapted = _cssAdapter(clazz);

                      if (adapted != null) {
                          // Append the old one along with the adapted one
                          return adapted + ' ' + clazz;
                      }

                      return clazz;
                  };
              }

              var containerCss = this.options.get('containerCss') || {};

              if ($.isFunction(containerCss)) {
                  containerCss = containerCss(this.$element);
              }

              CompatUtils.syncCssClasses($container, this.$element, containerCssAdapter);

              $container.css(containerCss);
              $container.addClass(containerCssClass);

              return $container;
          };

          return ContainerCSS;
      });

      S2.define('select2/compat/dropdownCss', [
        'jquery',
        './utils'
      ], function ($, CompatUtils) {
          // No-op CSS adapter that discards all classes by default
          function _dropdownAdapter(clazz) {
              return null;
          }

          function DropdownCSS() { }

          DropdownCSS.prototype.render = function (decorated) {
              var $dropdown = decorated.call(this);

              var dropdownCssClass = this.options.get('dropdownCssClass') || '';

              if ($.isFunction(dropdownCssClass)) {
                  dropdownCssClass = dropdownCssClass(this.$element);
              }

              var dropdownCssAdapter = this.options.get('adaptDropdownCssClass');
              dropdownCssAdapter = dropdownCssAdapter || _dropdownAdapter;

              if (dropdownCssClass.indexOf(':all:') !== -1) {
                  dropdownCssClass = dropdownCssClass.replace(':all:', '');

                  var _cssAdapter = dropdownCssAdapter;

                  dropdownCssAdapter = function (clazz) {
                      var adapted = _cssAdapter(clazz);

                      if (adapted != null) {
                          // Append the old one along with the adapted one
                          return adapted + ' ' + clazz;
                      }

                      return clazz;
                  };
              }

              var dropdownCss = this.options.get('dropdownCss') || {};

              if ($.isFunction(dropdownCss)) {
                  dropdownCss = dropdownCss(this.$element);
              }

              CompatUtils.syncCssClasses($dropdown, this.$element, dropdownCssAdapter);

              $dropdown.css(dropdownCss);
              $dropdown.addClass(dropdownCssClass);

              return $dropdown;
          };

          return DropdownCSS;
      });

      S2.define('select2/compat/initSelection', [
        'jquery'
      ], function ($) {
          function InitSelection(decorated, $element, options) {
              if (options.get('debug') && window.console && console.warn) {
                  console.warn(
                    'Select2: The `initSelection` option has been deprecated in favor' +
                    ' of a custom data adapter that overrides the `current` method. ' +
                    'This method is now called multiple times instead of a single ' +
                    'time when the instance is initialized. Support will be removed ' +
                    'for the `initSelection` option in future versions of Select2'
                  );
              }

              this.initSelection = options.get('initSelection');
              this._isInitialized = false;

              decorated.call(this, $element, options);
          }

          InitSelection.prototype.current = function (decorated, callback) {
              var self = this;

              if (this._isInitialized) {
                  decorated.call(this, callback);

                  return;
              }

              this.initSelection.call(null, this.$element, function (data) {
                  self._isInitialized = true;

                  if (!$.isArray(data)) {
                      data = [data];
                  }

                  callback(data);
              });
          };

          return InitSelection;
      });

      S2.define('select2/compat/inputData', [
        'jquery'
      ], function ($) {
          function InputData(decorated, $element, options) {
              this._currentData = [];
              this._valueSeparator = options.get('valueSeparator') || ',';

              if ($element.prop('type') === 'hidden') {
                  if (options.get('debug') && console && console.warn) {
                      console.warn(
                        'Select2: Using a hidden input with Select2 is no longer ' +
                        'supported and may stop working in the future. It is recommended ' +
                        'to use a `<select>` element instead.'
                      );
                  }
              }

              decorated.call(this, $element, options);
          }

          InputData.prototype.current = function (_, callback) {
              function getSelected(data, selectedIds) {
                  var selected = [];

                  if (data.selected || $.inArray(data.id, selectedIds) !== -1) {
                      data.selected = true;
                      selected.push(data);
                  } else {
                      data.selected = false;
                  }

                  if (data.children) {
                      selected.push.apply(selected, getSelected(data.children, selectedIds));
                  }

                  return selected;
              }

              var selected = [];

              for (var d = 0; d < this._currentData.length; d++) {
                  var data = this._currentData[d];

                  selected.push.apply(
                    selected,
                    getSelected(
                      data,
                      this.$element.val().split(
                        this._valueSeparator
                      )
                    )
                  );
              }

              callback(selected);
          };

          InputData.prototype.select = function (_, data) {
              if (!this.options.get('multiple')) {
                  this.current(function (allData) {
                      $.map(allData, function (data) {
                          data.selected = false;
                      });
                  });

                  this.$element.val(data.id);
                  this.$element.trigger('change');
              } else {
                  var value = this.$element.val();
                  value += this._valueSeparator + data.id;

                  this.$element.val(value);
                  this.$element.trigger('change');
              }
          };

          InputData.prototype.unselect = function (_, data) {
              var self = this;

              data.selected = false;

              this.current(function (allData) {
                  var values = [];

                  for (var d = 0; d < allData.length; d++) {
                      var item = allData[d];

                      if (data.id == item.id) {
                          continue;
                      }

                      values.push(item.id);
                  }

                  self.$element.val(values.join(self._valueSeparator));
                  self.$element.trigger('change');
              });
          };

          InputData.prototype.query = function (_, params, callback) {
              var results = [];

              for (var d = 0; d < this._currentData.length; d++) {
                  var data = this._currentData[d];

                  var matches = this.matches(params, data);

                  if (matches !== null) {
                      results.push(matches);
                  }
              }

              callback({
                  results: results
              });
          };

          InputData.prototype.addOptions = function (_, $options) {
              var options = $.map($options, function ($option) {
                  return $.data($option[0], 'data');
              });

              this._currentData.push.apply(this._currentData, options);
          };

          return InputData;
      });

      S2.define('select2/compat/matcher', [
        'jquery'
      ], function ($) {
          function oldMatcher(matcher) {
              function wrappedMatcher(params, data) {
                  var match = $.extend(true, {}, data);

                  if (params.term == null || $.trim(params.term) === '') {
                      return match;
                  }

                  if (data.children) {
                      for (var c = data.children.length - 1; c >= 0; c--) {
                          var child = data.children[c];

                          // Check if the child object matches
                          // The old matcher returned a boolean true or false
                          var doesMatch = matcher(params.term, child.text, child);

                          // If the child didn't match, pop it off
                          if (!doesMatch) {
                              match.children.splice(c, 1);
                          }
                      }

                      if (match.children.length > 0) {
                          return match;
                      }
                  }

                  if (matcher(params.term, data.text, data)) {
                      return match;
                  }

                  return null;
              }

              return wrappedMatcher;
          }

          return oldMatcher;
      });

      S2.define('select2/compat/query', [

      ], function () {
          function Query(decorated, $element, options) {
              if (options.get('debug') && window.console && console.warn) {
                  console.warn(
                    'Select2: The `query` option has been deprecated in favor of a ' +
                    'custom data adapter that overrides the `query` method. Support ' +
                    'will be removed for the `query` option in future versions of ' +
                    'Select2.'
                  );
              }

              decorated.call(this, $element, options);
          }

          Query.prototype.query = function (_, params, callback) {
              params.callback = callback;

              var query = this.options.get('query');

              query.call(null, params);
          };

          return Query;
      });

      S2.define('select2/dropdown/attachContainer', [

      ], function () {
          function AttachContainer(decorated, $element, options) {
              decorated.call(this, $element, options);
          }

          AttachContainer.prototype.position =
            function (decorated, $dropdown, $container) {
                var $dropdownContainer = $container.find('.dropdown-wrapper');
                $dropdownContainer.append($dropdown);

                $dropdown.addClass('select2-dropdown--below');
                $container.addClass('select2-container--below');
            };

          return AttachContainer;
      });

      S2.define('select2/dropdown/stopPropagation', [

      ], function () {
          function StopPropagation() { }

          StopPropagation.prototype.bind = function (decorated, container, $container) {
              decorated.call(this, container, $container);

              var stoppedEvents = [
              'blur',
              'change',
              'click',
              'dblclick',
              'focus',
              'focusin',
              'focusout',
              'input',
              'keydown',
              'keyup',
              'keypress',
              'mousedown',
              'mouseenter',
              'mouseleave',
              'mousemove',
              'mouseover',
              'mouseup',
              'search',
              'touchend',
              'touchstart'
              ];

              this.$dropdown.on(stoppedEvents.join(' '), function (evt) {
                  evt.stopPropagation();
              });
          };

          return StopPropagation;
      });

      S2.define('select2/selection/stopPropagation', [

      ], function () {
          function StopPropagation() { }

          StopPropagation.prototype.bind = function (decorated, container, $container) {
              decorated.call(this, container, $container);

              var stoppedEvents = [
                'blur',
                'change',
                'click',
                'dblclick',
                'focus',
                'focusin',
                'focusout',
                'input',
                'keydown',
                'keyup',
                'keypress',
                'mousedown',
                'mouseenter',
                'mouseleave',
                'mousemove',
                'mouseover',
                'mouseup',
                'search',
                'touchend',
                'touchstart'
              ];

              this.$selection.on(stoppedEvents.join(' '), function (evt) {
                  evt.stopPropagation();
              });
          };

          return StopPropagation;
      });

      /*!
       * jQuery Mousewheel 3.1.13
       *
       * Copyright jQuery Foundation and other contributors
       * Released under the MIT license
       * http://jquery.org/license
       */

      (function (factory) {
          if (typeof S2.define === 'function' && S2.define.amd) {
              // AMD. Register as an anonymous module.
              S2.define('jquery-mousewheel', ['jquery'], factory);
          } else if (typeof exports === 'object') {
              // Node/CommonJS style for Browserify
              module.exports = factory;
          } else {
              // Browser globals
              factory(jQuery);
          }
      }(function ($) {

          var toFix = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'],
              toBind = ('onwheel' in document || document.documentMode >= 9) ?
                          ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
              slice = Array.prototype.slice,
              nullLowestDeltaTimeout, lowestDelta;

          if ($.event.fixHooks) {
              for (var i = toFix.length; i;) {
                  $.event.fixHooks[toFix[--i]] = $.event.mouseHooks;
              }
          }

          var special = $.event.special.mousewheel = {
              version: '3.1.12',

              setup: function () {
                  if (this.addEventListener) {
                      for (var i = toBind.length; i;) {
                          this.addEventListener(toBind[--i], handler, false);
                      }
                  } else {
                      this.onmousewheel = handler;
                  }
                  // Store the line height and page height for this particular element
                  $.data(this, 'mousewheel-line-height', special.getLineHeight(this));
                  $.data(this, 'mousewheel-page-height', special.getPageHeight(this));
              },

              teardown: function () {
                  if (this.removeEventListener) {
                      for (var i = toBind.length; i;) {
                          this.removeEventListener(toBind[--i], handler, false);
                      }
                  } else {
                      this.onmousewheel = null;
                  }
                  // Clean up the data we added to the element
                  $.removeData(this, 'mousewheel-line-height');
                  $.removeData(this, 'mousewheel-page-height');
              },

              getLineHeight: function (elem) {
                  var $elem = $(elem),
                      $parent = $elem['offsetParent' in $.fn ? 'offsetParent' : 'parent']();
                  if (!$parent.length) {
                      $parent = $('body');
                  }
                  return parseInt($parent.css('fontSize'), 10) || parseInt($elem.css('fontSize'), 10) || 16;
              },

              getPageHeight: function (elem) {
                  return $(elem).height();
              },

              settings: {
                  adjustOldDeltas: true, // see shouldAdjustOldDeltas() below
                  normalizeOffset: true  // calls getBoundingClientRect for each event
              }
          };

          $.fn.extend({
              mousewheel: function (fn) {
                  return fn ? this.bind('mousewheel', fn) : this.trigger('mousewheel');
              },

              unmousewheel: function (fn) {
                  return this.unbind('mousewheel', fn);
              }
          });


          function handler(event) {
              var orgEvent = event || window.event,
                  args = slice.call(arguments, 1),
                  delta = 0,
                  deltaX = 0,
                  deltaY = 0,
                  absDelta = 0,
                  offsetX = 0,
                  offsetY = 0;
              event = $.event.fix(orgEvent);
              event.type = 'mousewheel';

              // Old school scrollwheel delta
              if ('detail' in orgEvent) { deltaY = orgEvent.detail * -1; }
              if ('wheelDelta' in orgEvent) { deltaY = orgEvent.wheelDelta; }
              if ('wheelDeltaY' in orgEvent) { deltaY = orgEvent.wheelDeltaY; }
              if ('wheelDeltaX' in orgEvent) { deltaX = orgEvent.wheelDeltaX * -1; }

              // Firefox < 17 horizontal scrolling related to DOMMouseScroll event
              if ('axis' in orgEvent && orgEvent.axis === orgEvent.HORIZONTAL_AXIS) {
                  deltaX = deltaY * -1;
                  deltaY = 0;
              }

              // Set delta to be deltaY or deltaX if deltaY is 0 for backwards compatabilitiy
              delta = deltaY === 0 ? deltaX : deltaY;

              // New school wheel delta (wheel event)
              if ('deltaY' in orgEvent) {
                  deltaY = orgEvent.deltaY * -1;
                  delta = deltaY;
              }
              if ('deltaX' in orgEvent) {
                  deltaX = orgEvent.deltaX;
                  if (deltaY === 0) { delta = deltaX * -1; }
              }

              // No change actually happened, no reason to go any further
              if (deltaY === 0 && deltaX === 0) { return; }

              // Need to convert lines and pages to pixels if we aren't already in pixels
              // There are three delta modes:
              //   * deltaMode 0 is by pixels, nothing to do
              //   * deltaMode 1 is by lines
              //   * deltaMode 2 is by pages
              if (orgEvent.deltaMode === 1) {
                  var lineHeight = $.data(this, 'mousewheel-line-height');
                  delta *= lineHeight;
                  deltaY *= lineHeight;
                  deltaX *= lineHeight;
              } else if (orgEvent.deltaMode === 2) {
                  var pageHeight = $.data(this, 'mousewheel-page-height');
                  delta *= pageHeight;
                  deltaY *= pageHeight;
                  deltaX *= pageHeight;
              }

              // Store lowest absolute delta to normalize the delta values
              absDelta = Math.max(Math.abs(deltaY), Math.abs(deltaX));

              if (!lowestDelta || absDelta < lowestDelta) {
                  lowestDelta = absDelta;

                  // Adjust older deltas if necessary
                  if (shouldAdjustOldDeltas(orgEvent, absDelta)) {
                      lowestDelta /= 40;
                  }
              }

              // Adjust older deltas if necessary
              if (shouldAdjustOldDeltas(orgEvent, absDelta)) {
                  // Divide all the things by 40!
                  delta /= 40;
                  deltaX /= 40;
                  deltaY /= 40;
              }

              // Get a whole, normalized value for the deltas
              delta = Math[delta >= 1 ? 'floor' : 'ceil'](delta / lowestDelta);
              deltaX = Math[deltaX >= 1 ? 'floor' : 'ceil'](deltaX / lowestDelta);
              deltaY = Math[deltaY >= 1 ? 'floor' : 'ceil'](deltaY / lowestDelta);

              // Normalise offsetX and offsetY properties
              if (special.settings.normalizeOffset && this.getBoundingClientRect) {
                  var boundingRect = this.getBoundingClientRect();
                  offsetX = event.clientX - boundingRect.left;
                  offsetY = event.clientY - boundingRect.top;
              }

              // Add information to the event object
              event.deltaX = deltaX;
              event.deltaY = deltaY;
              event.deltaFactor = lowestDelta;
              event.offsetX = offsetX;
              event.offsetY = offsetY;
              // Go ahead and set deltaMode to 0 since we converted to pixels
              // Although this is a little odd since we overwrite the deltaX/Y
              // properties with normalized deltas.
              event.deltaMode = 0;

              // Add event and delta to the front of the arguments
              args.unshift(event, delta, deltaX, deltaY);

              // Clearout lowestDelta after sometime to better
              // handle multiple device types that give different
              // a different lowestDelta
              // Ex: trackpad = 3 and mouse wheel = 120
              if (nullLowestDeltaTimeout) { clearTimeout(nullLowestDeltaTimeout); }
              nullLowestDeltaTimeout = setTimeout(nullLowestDelta, 200);

              return ($.event.dispatch || $.event.handle).apply(this, args);
          }

          function nullLowestDelta() {
              lowestDelta = null;
          }

          function shouldAdjustOldDeltas(orgEvent, absDelta) {
              // If this is an older event and the delta is divisable by 120,
              // then we are assuming that the browser is treating this as an
              // older mouse wheel event and that we should divide the deltas
              // by 40 to try and get a more usable deltaFactor.
              // Side note, this actually impacts the reported scroll distance
              // in older browsers and can cause scrolling to be slower than native.
              // Turn this off by setting $.event.special.mousewheel.settings.adjustOldDeltas to false.
              return special.settings.adjustOldDeltas && orgEvent.type === 'mousewheel' && absDelta % 120 === 0;
          }

      }));

      S2.define('jquery.select2', [
        'jquery',
        'jquery-mousewheel',

        './select2/core',
        './select2/defaults'
      ], function ($, _, Select2, Defaults) {
          if ($.fn.select2 == null) {
              // All methods that should return the element
              var thisMethods = ['open', 'close', 'destroy'];

              $.fn.select2 = function (options) {
                  options = options || {};

                  if (typeof options === 'object') {
                      this.each(function () {
                          var instanceOptions = $.extend(true, {}, options);

                          var instance = new Select2($(this), instanceOptions);
                      });

                      return this;
                  } else if (typeof options === 'string') {
                      var ret;

                      this.each(function () {
                          var instance = $(this).data('select2');

                          if (instance == null && window.console && console.error) {
                              console.error(
                                'The select2(\'' + options + '\') method was called on an ' +
                                'element that is not using Select2.'
                              );
                          }

                          var args = Array.prototype.slice.call(arguments, 1);

                          ret = instance[options].apply(instance, args);
                      });

                      // Check if we should be returning `this`
                      if ($.inArray(options, thisMethods) > -1) {
                          return this;
                      }

                      return ret;
                  } else {
                      throw new Error('Invalid arguments for Select2: ' + options);
                  }
              };
          }

          if ($.fn.select2.defaults == null) {
              $.fn.select2.defaults = Defaults;
          }

          return Select2;
      });

      // Return the AMD loader configuration so it can be used outside of this file
      return {
          define: S2.define,
          require: S2.require
      };
  }());

    // Autoload the jQuery bindings
    // We know that all of the modules exist above this, so we're safe
    var select2 = S2.require('jquery.select2');

    // Hold the AMD module references on the jQuery function that was just loaded
    // This allows Select2 to use the internal loader outside of this file, such
    // as in the language files.
    jQuery.fn.select2.amd = S2;

    // Return the Select2 instance for anyone who is importing it.
    return select2;
}));
