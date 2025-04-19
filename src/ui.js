"use strict";

$(document).ready(function() {
  /**
   * Normalizes numeric strings by stripping currency/percentage signs and group separators:
   * '13.01%' -> '13.01', '$5,124.88' -> '5124.88'
   * 
   * @param {string} str string representation of number formatted as percentage or currency
   * @returns {string} normalized string representation of number
   */
  const normalizeNumericString = function(str)
  {
    if(typeof str === 'string' || str instanceof String)
    {
      [new RegExp(`^\\${CURRENCY_SIGN}`), new RegExp(`${PERCENT_SIGN}$`), new RegExp(GROUP_SEPARATOR) ]
        .forEach((regex) => str = str.replace(regex, ''));
    }
    return str;
  }

  /**
   * Formats number as currency
   * Does not omit trailing zeros: 13.00 -> '$13.00', 13.01 -> '$13.01'
   * 
   * @param {BigNumber} bigNumber 
   * @returns {string} string representation of number
   */
  const formatCurrency = function(bigNumber)
  {
    return bigNumber.toFormat(2, { prefix: CURRENCY_SIGN,
      decimalSeparator: DECIMAL_SEPARATOR,
      groupSeparator: GROUP_SEPARATOR,
      groupSize: 3 });
  }

  /**
   * Formats number as percentage
   * Omits trailing zeros: 13.00 -> '13%', 13.01 -> '13.01%'
   * 
   * @param {BigNumber} bigNumber 
   * @returns {string} string representation of the number
   */
  const formatPercentage = function(bigNumber)
  {
    return (bigNumber.isNaN() ? new BigNumber(0) : bigNumber)
      .toFormat(2, { decimalSeparator: DECIMAL_SEPARATOR })
      .replace(/\.0{2}$/, '') // cut off '.00' part
      .concat(PERCENT_SIGN);
  }

  /**
   * Enable control buttons
   */
  const enableControls = function()
  {
    const jqCalculateButton = $('#calculateButton');
    jqCalculateButton.prop('disabled', false);
    jqCalculateButton.val('Start calculation');

    $('.singular-input').prop('readonly', false);

    toggleAddNewAssetButtonIfMaxAssetsReached();
    $('.table-action-button').prop('disabled', false);
    $('#load-sample-data-button').prop('disabled', false);
    $('#solutions-button').prop('disabled', false);
  }

  /**
   * Disable control buttons
   */
  const disableControls = function()
  {
    const jqCalculateButton = $('#calculateButton');
    jqCalculateButton.prop('disabled', true);
    jqCalculateButton.val('Calculating...');

    $('.singular-input').prop('readonly', true);

    $('#add-new-asset-button').prop('disabled', true);
    $('.table-action-button').prop('disabled', true);
    $('#load-sample-data-button').prop('disabled', true);
    $('#solutions-button').prop('disabled', true);
  }

  /**
   * Disable Add New Asset button if user wants to add more than MAX_ASSETS.
   * Enable it back if user deletes some assets.
   */
  const toggleAddNewAssetButtonIfMaxAssetsReached = function()
  {
    const jqAddNewAssetButton = $('#add-new-asset-button');
    if($('#results > tbody > tr').length >= MAX_ASSETS)
    {
      jqAddNewAssetButton.prop('disabled', true);
      jqAddNewAssetButton.text(`No more than ${MAX_ASSETS} assets allowed`);
    }
    else
    {
      jqAddNewAssetButton.prop('disabled', false);
      jqAddNewAssetButton.text('Add new asset');
    }
  }

  /**
   * Disable Start Calculation button if there are 0 assets.
   * Enable it back if user adds some assets.
   */
  const toggleStartCalculationButtonIfZeroAssetsReached = function()
  {
    $('#calculateButton').prop('disabled', $('#results > tbody > tr').length === 0);
  }

  /**
   * Format all numeric columns in the table to have right text alignment
   */
  const setTableColumnRightAlignment = function()
  {
    const resultsTableColumnsCount = $('#results > thead th').length;
    for(let i = 2; i <= resultsTableColumnsCount; i++)
    {
        $(`#results td:nth-child(${i})`).addClass('text-end');
    }
  }

  /**
   * Fill non-editable table columns with question marks
   * when there are no calculated results to fill them with numbers
   * 
   * @param {Object} row Table row
  */
  const setNonEditableTableCellsToQuestionMarks = function(row)
  {
    const jqAddedRowCells = $(row).find('td');
    jqAddedRowCells.each((index, elem) => {
      const jqCell = $(elem);
      if(index > LAST_EDITABLE_CELL_INDEX && jqCell.attr('name') !== 'bstable-actions')
      {
        jqCell.text('?');
      }
    });
  }

  /**
   * Hide calculated results (when user makes changes to the input data)
  */  
  const hideCalculatedResults = function()
  {
    $('#results > tfoot').hide();
    $('#chart-container').hide();
    $('#log-container').hide();
    $('#results > tfoot').hide();

    $('#results > tbody > tr').each((index, elem) => {
      setNonEditableTableCellsToQuestionMarks(elem);
    });

    uniqueSolutions.length = 0;
    $('#solutions-button').hide();
    $('#solutions-dropdown-menu > a').each((i, elem) => {
      $(elem).remove(); // delete menu items
    });
  }

  /**
   * Generate random ids that are used for identifying:
   * 1) table rows, and 2) hidden inputs holding information from table rows
   * 
   * @returns {string} string that looks like 'd236d02fb5ca28'
  */  
  const generateRandomId = function()
  {
    return Math.random().toString(16).slice(2);
  }

  /**
   * Get random id from hidden input name (that looks like 'assetName_d236d02fb5ca28')
   * 
   * @param {string} fullHiddenInputName Hidden input name
   * @returns {string} random id name part ('d236d02fb5ca28')
  */ 
  const getRandomIdFromHiddenInputName = function(fullHiddenInputName)
  {
    const match = fullHiddenInputName.match(/_([\d\w]+)$/);
    return !match ? null : match[1];
  }

  /**
   * Load table row values into hidden inputs with appropriate names
   * 
   * @param {Object} row Table row
  */ 
  const editHiddenInputsAssociatedWithTableRow = function(row)
  {
    // read text from row cells, find an appropriate hidden input
    // (or create one if it doesn't exist)
    // and put the cell text into the hidden input
    const jqRow = $(row);
    const rowId = jqRow.data('id');
    const hiddenInputWrapper = $('#hiddenInputs');
    const hiddenInputNameTemplates = Array.from(validationRuleTemplates.keys());
    for(let i = 0; i < hiddenInputNameTemplates.length; i++)
    {
      const hiddenInputName = `${hiddenInputNameTemplates[i]}${rowId}`;
      let hiddenInput = $(`#${hiddenInputName}`);
      if(hiddenInput.length == 0)
      {
        hiddenInput = $(`<input type="text" id="${hiddenInputName}" name="${hiddenInputName}" class="hidden-input">`);
        hiddenInput.appendTo(hiddenInputWrapper);
      }
      const cellText = jqRow.find(`td:nth-child(${i + 1})`).text();
      hiddenInput.val(cellText);
      hiddenInput.keyup(); // if we have an existing form validator, signal to it that we must revalidate
    }

    // signal to the validator that we must revalidate its group rules
    $('#groupAssetValidation').keyup();
  }

  /**
   * Delete hidden inputs with appropriate names containing table row values
   * 
   * @param {Object} row Table row
  */ 
  const deleteHiddenInputsAssociatedWithTableRow = function(row)
  {
    // remove hidden inputs associated with row being deleted
    const rowId = $(row).data('id');
    $(`input[id*="_${rowId}"]`).each((index, elem) => {
      $(elem).remove();
    });

    // signal to the validator that we must revalidate its group rules
    $('#groupAssetValidation').keyup();
  }


  /**
   * Creates a chart or updates an existing chart with new data, then renders it
   * 
   * @param {string} chartId Id of chart container
   * @param {string} chartTitle Chart title
   * @param {Array} dataPoints Array of chart data points
  */ 
  const renderChart = function(chartId, chartTitle, dataPoints)
  {
    let chart = charts.get(chartId); // try getting chart
    if(!chart)
    {
      const concreteChartOptions = structuredClone(genericPieChartOptions);
      concreteChartOptions.title.text = chartTitle;
      concreteChartOptions.data[0].dataPoints = dataPoints;
      chart = new CanvasJS.Chart(chartId, concreteChartOptions);
      charts.set(chartId, chart); // store newly created chart
    }
    else
    {
      chart.options.data[0].dataPoints = dataPoints;
    }
    chart.render();
  }

  /**
   * Checks if a value is defined
   * 
   * @param {any} obj Object value
   * @returns {boolean} True if maps are equal, false otherwise
  */ 
  const isDefined = function(obj)
  {
    return typeof obj !== 'undefined';
  }

  /**
   * Checks if two maps are equal
   * 
   * @param {Map} map1 First map
   * @param {Map} map2 Second map
   * @returns {boolean} True if maps are equal, false otherwise
  */ 
  const areMapsEqual = function(map1, map2)
  {
    let testVal;
    if (map1.size !== map2.size)
    {
      return false;
    }
    for (let [key, val] of map1)
    {
        testVal = map2.get(key);
        // in cases of an undefined value, make sure the key
        // actually exists on the object so there are no false positives
        if (testVal !== val || (!isDefined(testVal) && !map2.has(key)))
        {
          return false;
        }
    }
    return true;
  }

  /**
   * Checks if a calculated solution is unique and needs to be stored in the uniqueSolutions array
   * 
   * @param {any} generationData Calculated solution
   * @returns {boolean} True if a calculated solution is unique, false otherwise
  */ 
  const isGenerationDataUniqueSolution = function(generationData)
  {
    // checking if we have a unique solution and not a dupe:
    // comparing numbers of shares to buy and total projected investments
    const sharesToBuy = new Map(generationData.strategyStats.stats.map((elem) => [elem.assetName, elem.sharesCount]));
    const totalProjectedInvestment = generationData.strategyStats.totalProjectedInvestment;
    for(const solution of uniqueSolutions)
    {
      const solutionSharesToBuy = new Map(solution.strategyStats.stats.map((elem) => [elem.assetName, elem.sharesCount]));
      const solutionTotalProjectedInvestment = solution.strategyStats.totalProjectedInvestment;
      if(areMapsEqual(sharesToBuy, solutionSharesToBuy) &&
        totalProjectedInvestment.comparedTo(solutionTotalProjectedInvestment) === 0)
      {
        return false; // found a solution that is a dupe of generationData, no need to store generationData
      }
    }
    return true;
  }

  /**
   * Displays final calculated solution (table and charts)
   * 
   * @param {any} generationData Calculated solution
  */ 
  const displayFinalGenerationData = function(generationData)
  {
    const jqTrs = $('#results > tbody > tr');
    jqTrs.empty();
    for(let i = 0; i < jqTrs.length; i++)
    {
      const stat = generationData.strategyStats.stats[i];
      $(jqTrs[i]).append($('<td>').text(stat.assetName),
        $('<td>').text(formatPercentage(stat.targetPercentage)),
        $('<td>').text(formatCurrency(stat.currentTotalValue)),
        $('<td>').text(formatCurrency(stat.currentSharePrice)),
        $('<td>').text(formatPercentage(stat.currentPercentage)),
        $('<td>').text(stat.sharesCount),
        $('<td>').text(formatPercentage(stat.rebalancedPercentage)),
        $('<td>').text(formatCurrency(stat.projectedInvestment)));
      editHiddenInputsAssociatedWithTableRow(jqTrs[i]);
    }
    setTableColumnRightAlignment();
    editableTable.refresh();
    $('#results > tfoot').show();
    $('#results-spent').text(`Found a solution at generation ${generationData.generation}, ` + 
      `spent ${formatCurrency(generationData.strategyStats.totalProjectedInvestment)} ` +
      `out of ${formatCurrency(generationData.investmentLimit)}, ` +
      `${formatCurrency(generationData.investmentLimit.minus(generationData.strategyStats.totalProjectedInvestment))} remained.`);

    $('#chart-container').show();
    renderChart('current-chart-container', 'Current Percentage', generationData.strategyStats.stats.map(elem => 
      ({ label: elem.assetName, y: elem.currentPercentage.toNumber() })));
    renderChart('projected-chart-container', 'Rebalanced Percentage', generationData.strategyStats.stats.map(elem => 
      ({ label: elem.assetName, y: elem.rebalancedPercentage.toNumber() })));    
  }

  /**
   * Displays a button with menu to switch between unique solutions if there are more than 1 of them
  */ 
  const displaySolutionsButton = function()
  {
    if(uniqueSolutions.length <= 1)
    {
      return; // don't do anything if there are 0 or 1 solutions
    }

    $('#solutions-dropdown-menu > a').each((i, elem) => {
      $(elem).remove(); // delete menu items
    });
    for(const solution of uniqueSolutions)
    {
      $('<a>',{
          text: 'Shares to buy: (' + 
            solution.strategyStats.stats.map((elem) => elem.sharesCount).join(' - ') + 
            `), ${formatCurrency(solution.investmentLimit.minus(solution.strategyStats.totalProjectedInvestment))} remained`,
          href: '#',
          click: function()
          {
            displayFinalGenerationData(solution);
            $('#log').val('Solution loaded from memory, log unavailable.');
            return false;
          }
      })
      .addClass('dropdown-item')
      .prependTo('#solutions-dropdown-menu');
    }
    $('#solutions-button').show();
  }

  /**
   * Displays generation (in the log if intermediate, in the table and charts if final)
   * 
   * @param {any} generationData Calculated solution
  */ 
  const displayGeneration = function(generationData)
  {
    let isFinalGeneration = false;

    const log = $('#log');

    // intermediate generation reached - display in log
    log.val(`Generation ${generationData.generation}:    ${stringifyInvestmentStrategy(generationData.result)}\n${log.val()}`);

    // final generation reached - display calculated stats
    if(generationData.strategyStats)
    {
      isFinalGeneration = true;

      displayFinalGenerationData(generationData);

      if(isGenerationDataUniqueSolution(generationData))
      {
        uniqueSolutions.push(generationData);
        uniqueSolutions.splice(0, uniqueSolutions.length - STORE_LAST_UNIQUE_SOLUTIONS_COUNT);
        displaySolutionsButton();
      }
    }
    return isFinalGeneration;
  }

  /**
   * Restores values of type BigNumber in an object
   * (BigNumber type cannot pass between Web Worker and main thread because of how serialization is done,
   * so it needs to be restored when we get a message from Web Worker)
   * 
   * @param {any} obj Object containing poorly serialized BigNumber values
  */ 
  const restoreBigNumbersInObject = function(obj)
  {
    for(const property in obj)
    {
      if(obj.hasOwnProperty(property))
      {
        if(typeof obj[property] == "object")
        {
          if(isDefined(obj[property]['s']) && isDefined(obj[property]['e']) && isDefined(obj[property]['c']))
          {
            obj[property] = new BigNumber({ s: obj[property]['s'], e: obj[property]['e'], c: obj[property]['c'], _isBigNumber: true });
          }
          else
          {
            restoreBigNumbersInObject(obj[property]);
          }
        }
      } 
    }
  }

  /**
   * Stringifies investment strategy
   * 
   * @param {InvestmentStrategy} is Investment stragegy
   * @returns {str} Stringified investment strategy and its fitness
  */ 
  const stringifyInvestmentStrategy = function(is)
  {
    let stringifiedAssets = [];
    is.strategy.forEach((value, key) => stringifiedAssets.push(`'${key}': ${value}`));
    return `${stringifiedAssets.join(', ')}    Fitness: ${is.fitness}`;
  }

  /**
   * Get paths to scripts that are needed for the Web Worker thread to work correctly
   * 
   * @returns {str[]} Array of paths to scripts
  */ 
  const getImportScriptUrls = function()
  {
    const imports = [ [ 'src', 'genetic.js' ], 'https://cdn.jsdelivr.net/npm/bignumber.js@9.1.2/bignumber.min.js' ];

    let parts = document.location.href.split('/');
    parts.pop(); // remove last element
    
    let scriptUrls = [];
    for(const imprt of imports)
    {
      // push remote script urls as is
      if(typeof imprt === 'string' && imprt.startsWith('http'))
      {
        scriptUrls.push(imprt);
      }
      // push local script urls as absolute paths to files
      else
      {
        scriptUrls.push(`${parts.join('/')}/${imprt.join('/')}`);
      }
    }
    return scriptUrls;
  }

  /**
   * Creates a Web Worker thread that will execute our genetic algorithm
   * 
   * @returns {Worker} Reference to the Web Worker thread
  */ 
  const createWorker = function()
  {
    function work({data}) // destructuring assignment
    {
      /* the following code will execute in the context of the Web Worker */
      let assetData = new Map();
      for(const a of data.assetData)
      {
        assetData.set(a.name, new AssetData(new BigNumber(a.targetPercentage), new BigNumber(a.currentTotalValue), new BigNumber(a.currentSharePrice)));
      }
      const populationSize = parseInt(data.populationSize, 10);
      const stopAfterNGenerationsWithoutBetterResult = parseInt(data.stopAfterNGenerationsWithoutBetterResult, 10);
      const investmentLimit = new BigNumber(data.investmentLimit);
      const callback = self.postMessage;
      StrategyPopulationManager.runWorker(populationSize, stopAfterNGenerationsWithoutBetterResult, assetData, investmentLimit, callback);
      /* previous code will execute in the context of the Web Worker */
    }

    const scriptUrls = getImportScriptUrls();
    const imports = scriptUrls.map(scriptUrl => `self.importScripts('${scriptUrl}');`);
    let b = new Blob([imports.join("\n"), '\n\nonmessage=' + work.toString()], {type: "text/javascript"});
    const blobUrl = URL.createObjectURL(b);
    return new Worker(blobUrl);
  }

  const validationRuleTemplates = new Map([['assetName_', { 
      rules: { required: true, normalizer: $.trim },
      messages: { required: 'asset name is required.' } }],
    ['targetPercentage_', { 
      rules: { required: true, number: true, range: [0.01, 100], normalizer: normalizeNumericString },
      messages: { required: 'target percentage is required.', 
        number: 'target percentage must be a decimal number.',
        range: 'target percentage must be within range 0.01 to 100.' } }],
    ['currentTotalValue_', {
      rules: { required: true, number: true, min: 0, normalizer: normalizeNumericString },
      messages: { required: 'current total value is required.', 
        number: 'current total value must be a decimal number.',
        min: 'current total value must be greater than or equal to 0.' } }],
    ['currentSharePrice_', {
      rules: { required: true, number: true, min: 0.01, normalizer: normalizeNumericString },
      messages: { required: 'current share price is required.', 
        number: 'current share price must be a decimal number.',
        min: 'current share price must be greater than or equal to 0.01.' } }]]);

  $.validator.addMethod('assetNamesUnique', function()
  {
    let assetNames = [];
    $('input[id*="assetName_"]').each((index, elem) => assetNames.push(elem.value));
    assetNames.sort();
    let dupes = [];
    for (let i = 0; i < assetNames.length - 1; i++)
    {
      if (assetNames[i + 1] === assetNames[i])
      {
        dupes.push(assetNames[i]);
      }
    }
    $.validator.messages.assetNamesUnique = 
      `Asset names must be unique, found duplicates: [${dupes.map(elem => `'${elem}'`).join(', ')}].`;
    return dupes.length === 0;
  });

  $.validator.addMethod('targetPercentageSum', function(value, element, param)
  {
    const maxSum = new BigNumber(param);
    let sum = new BigNumber(0);
    $('input[id*="targetPercentage_"]').each((i, elem) => sum = sum.plus(new BigNumber(normalizeNumericString(elem.value))));
    $.validator.messages.targetPercentageSum = `Sum of target percentages must be ${formatPercentage(maxSum)}, found ${formatPercentage(sum)}.`;
    return sum.comparedTo(maxSum) === 0;
  });

  $.validator.addMethod('investmentLimitGreaterThanOrEqualToMinSharePrice', function()
  {
    const investmentLimit = BigNumber(normalizeNumericString($('#investmentLimit').val()));
    let currentSharePrices = [];
    $('input[id*="currentSharePrice_"]').each((i, elem) => currentSharePrices.push(BigNumber(normalizeNumericString(elem.value))));
    const minSharePrice = BigNumber.min(...currentSharePrices.filter(elem => !elem.isNaN()));
    if(investmentLimit.isNaN() || minSharePrice.isNaN())
    {
      return true; // don't fail if investment limit or share prices are NaNs
    }
    const comparison = minSharePrice.comparedTo(investmentLimit);
    return comparison === -1 || comparison === 0; // minSharePrice <= investmentLimit
  });

  const genericPieChartOptions = {
      title: { text: null, fontFamily: 'sans-serif', fontSize: 20 },
      data: [{
              type: "pie",
              startAngle: 270,
              radius: "90%",
              showInLegend: "false",
              legendText: "{label}",
              indexLabel: "{label} ({y}%)",
              yValueFormatString:"#,##0.00",
              dataPoints: null
      }]
  };
  const tableOptions = {
    editableColumns: [...Array(LAST_EDITABLE_CELL_INDEX + 1).keys()].map(elem => elem.toString()).join(','),
    $addButton: $('#add-new-asset-button'),
    onAdd: function() {
      const jqAddedRow = $('#results > tbody > tr:last');
      jqAddedRow.data('id', generateRandomId()); // generate random id for the new row
      editHiddenInputsAssociatedWithTableRow(jqAddedRow);
      setNonEditableTableCellsToQuestionMarks(jqAddedRow);
      setTableColumnRightAlignment();
      toggleAddNewAssetButtonIfMaxAssetsReached();
      toggleStartCalculationButtonIfZeroAssetsReached();
      hideCalculatedResults();
    },
    onEdit: function(row) {
      editHiddenInputsAssociatedWithTableRow(row);
      hideCalculatedResults();
    },
    onBeforeDelete: function(row) {
      deleteHiddenInputsAssociatedWithTableRow(row);
    },
    onDelete: function() {
      toggleAddNewAssetButtonIfMaxAssetsReached();
      toggleStartCalculationButtonIfZeroAssetsReached();
      hideCalculatedResults();
    },
    advanced: {
      columnLabel: 'Actions',
      buttonHTML: `<div class="btn-group pull-right">
              <button id="bEdit" type="button" class="btn btn-sm btn-default table-action-button" title="Edit">
                  <span class="bi bi-pencil-square"></span>
              </button>
              <button id="bDel" type="button" class="btn btn-sm btn-default table-action-button" title="Delete">
                  <span class="bi bi-trash3"></span>
              </button>
              <button id="bAcep" type="button" class="btn btn-sm btn-default table-action-button" style="display:none;" title="Save">
                  <span class="bi bi-check2-square" > </span>
              </button>
              <button id="bCanc" type="button" class="btn btn-sm btn-default table-action-button" style="display:none;" title="Cancel">
                  <span class="bi bi-x-square" > </span>
              </button>
          </div>`
    }
  };
  const validationOptions = {
    errorLabelContainer: "#errorSummary",
    wrapper: "div",
    errorClass: "is-invalid",
    ignore: '#results input',
    rules: {
      investmentLimit: { 
        required: true,
        number: true,
        min: 0.01,
        max: 100000.00,
        normalizer: normalizeNumericString
      },
      populationSize: {
        required: true,
        digits: true,
        range: [100, 1000]
      },
      stopAfterNGenerationsWithoutBetterResult: {
        required: true,
        digits: true,
        range: [5, 100]
      },
      groupAssetValidation: {
        assetNamesUnique: true,
        targetPercentageSum: 100,
        investmentLimitGreaterThanOrEqualToMinSharePrice: true
      }
    },
    messages: {
        investmentLimit: {
          required: 'Investment limit is required.',
          number: 'Investment limit must be a decimal number.',
          min: jQuery.validator.format('Investment limit must be greater than or equal to {0}.'),
          max: jQuery.validator.format('Investment limit must be less than or equal to {0}.')
        },
        populationSize: {
          required: 'Population size is required.',
          digits: 'Population size must be a positive integer.',
          range: jQuery.validator.format('Population size must be within range {0} to {1}.')
        },
        stopAfterNGenerationsWithoutBetterResult: {
          required: 'Number of generations is required.',
          digits: 'Number of generations must be a positive integer.',
          range: jQuery.validator.format('Number of generations must be within range {0} to {1}.')
        },
        groupAssetValidation: {
          investmentLimitGreaterThanOrEqualToMinSharePrice: 'Investment limit must be greater than or equal to at least one current share price.'
        }
    },
    invalidHandler: function(form, validator) {
      enableControls();
    },
    submitHandler: function(form) {
      $('#chart-container').hide();
      $('#log-container').show();
      $('#log').val('');

      const formData = new FormData(form);
      const populationSize = formData.get('populationSize');
      const investmentLimit = normalizeNumericString(formData.get('investmentLimit'));
      const stopAfterNGenerationsWithoutBetterResult = formData.get('stopAfterNGenerationsWithoutBetterResult');

      let assetData = [];
      $(`input[id*="assetName_"]`).each((index, elem) => {
        const id = getRandomIdFromHiddenInputName(elem.name);
        assetData.push({ name: formData.get(elem.name),
          targetPercentage: normalizeNumericString(formData.get(`targetPercentage_${id}`)),
          currentTotalValue: normalizeNumericString(formData.get(`currentTotalValue_${id}`)),
          currentSharePrice: normalizeNumericString(formData.get(`currentSharePrice_${id}`)) });
      });

      if(!worker)
      {
        worker = createWorker();
        worker.onmessage = ({data}) => {
          restoreBigNumbersInObject(data);
          const isFinalGeneration = displayGeneration(data);
          if(isFinalGeneration)
          {
            enableControls();
          }
        };
        worker.onerror = (error) => {
          console.log(`An error occurred in the web worker thread: '${error.message}' at ${error.filename}:${error.lineno}`);
          enableControls();
        };
      }

      worker.postMessage({ populationSize: populationSize,
        stopAfterNGenerationsWithoutBetterResult: stopAfterNGenerationsWithoutBetterResult,
        assetData: assetData,
        investmentLimit: investmentLimit });
    }
  };

  /**
   * Sets necessary values for running the genetic algorithm
  */ 
  const setInitialValues = function()
  {
    $('#populationSize').val(INIT_POPULATION_SIZE);
    $('#stopAfterNGenerationsWithoutBetterResult').val(INIT_STOP_AFTER_N_GENERATIONS_WITHOUT_BETTER_RESULT);
  };

  /**
   * Sets sample data to the table
   * 
   * @param {boolean} targetPercentagesOnly If only target percentages need to be set for every asset
  */ 
  const setSampleData = function(targetPercentagesOnly = false)
  {
    // delete table rows and corresponding hidden inputs
    $('#results > tbody > tr').each((i, elem) => {
      $(elem).remove();
    });
    $('input.hidden-input').each((i, elem) => {
      $(elem).remove();
    });
    // set sample data
    $('#investmentLimit').val(formatCurrency(new BigNumber(INIT_INVESTMENT_LIMIT)));
    for(const asset of SAMPLE_DATA)
    {
      const jqNewRow = $(`<tr data-id="${generateRandomId()}">`);
      jqNewRow.append(
        $('<td>').text(asset.name),
        $('<td>').text(formatPercentage(new BigNumber(asset.targetPercentage))),
        $('<td>').text(targetPercentagesOnly ? '?' : formatCurrency(new BigNumber(asset.currentTotalValue))),
        $('<td>').text(targetPercentagesOnly ? '?' : formatCurrency(new BigNumber(asset.currentSharePrice))),
        $('<td>').text('?'),
        $('<td>').text('?'),
        $('<td>').text('?'),
        $('<td>').text('?')
      ).appendTo('#results > tbody');
      editHiddenInputsAssociatedWithTableRow(jqNewRow);
    }
  }

  $('#investmentLimit').on('change', function() {
    hideCalculatedResults();
  });

  $('#load-sample-data-button').on('click', function(e) {
    e.preventDefault();
    setSampleData();
    setTableColumnRightAlignment();
    editableTable.refresh();
    toggleStartCalculationButtonIfZeroAssetsReached();
    hideCalculatedResults();
  });

  $('#calculateButton').on('click', function(e) {
    disableControls();
    validator?.destroy();

    const assetNameTemplate = 'assetName_';
    const hiddenInputNameTemplates = Array.from(validationRuleTemplates.keys());
    let extraValidationOptions = { rules: { }, messages: { } };

    for(let i = 0; i < hiddenInputNameTemplates.length; i++)
    {
      const hiddenInputNameTemplate = hiddenInputNameTemplates[i];
      $(`input[id*="${hiddenInputNameTemplate}"]`).each((index, elem) => {
        const qualifiedName = elem.name;
        extraValidationOptions.rules[qualifiedName] = validationRuleTemplates.get(hiddenInputNameTemplate).rules;

        extraValidationOptions.messages[qualifiedName] = {};
        const messages = validationRuleTemplates.get(hiddenInputNameTemplate).messages;
        const assetName = $(`#${assetNameTemplate}${getRandomIdFromHiddenInputName(qualifiedName)}`).val();
        for(const message in messages)
        {
          // if there's something wrong with asset name,
          // prefix error message with 'Table row N: <error>',
          // else prefix error message with 'Asset Name: <error>'
          const messagePrefix = hiddenInputNameTemplate === assetNameTemplate || !$.trim(assetName) ?
            `Table row ${index + 1}` :
            assetName;
          extraValidationOptions.messages[qualifiedName][message] = `${messagePrefix}: ${messages[message]}`;
        }
      });
    }

    const mergedRules = {...validationOptions.rules, ...extraValidationOptions.rules};
    const mergedMessages = {...validationOptions.messages, ...extraValidationOptions.messages};
    const form = $("#form");
    validator = form.validate({...validationOptions, ...{ rules: mergedRules, messages: mergedMessages }});
    form.submit();
  });

  let validator = null; // stores validator pointer because it must be destroyed for multiple validations
  let worker = null; // stores Web Worker pointer so we don't have to recreate worker thread multiple times
  let charts = new Map(); // stores charts pointers so we don't have to recreate them multiple times
  let uniqueSolutions = []; // stores unique solutions generated by the algorithm (if you later need to look at them)

  setInitialValues();
  setTableColumnRightAlignment();
  const editableTable = new BSTable('results', tableOptions);
  editableTable.init();
  toggleStartCalculationButtonIfZeroAssetsReached();
});