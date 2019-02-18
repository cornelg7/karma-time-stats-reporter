const chalk = require("chalk");
const columnify = require("columnify");

const defaultReporterOptions = {
  reportTimeStats: true,
  reportSlowestTests: true,
  binSize: 100,
  slowThreshold: 500,
  longestTestsCount: 5
};

function textFormat(val, { type = "info" } = {}) {
  switch (type) {
    case "warn":
      return chalk.yellow(val);
    default:
      return val;
  }
}

function percentageBar(
  val,
  {
    totalCharacters = 50,
    boundaryStartCharacter = "[",
    boundaryEndCharacter = "]",
    foregroundCharacter = "\u25AA",
    backgroundCharacter = " "
  } = {}
) {
  const fgCharacterCount = Math.floor((val / 100) * totalCharacters);
  const bgCharacterCount = totalCharacters - fgCharacterCount;

  const fg = foregroundCharacter.repeat(fgCharacterCount);
  let bg = backgroundCharacter.repeat(bgCharacterCount);
  let percentageValueText = "";

  if (bgCharacterCount > 3) {
    bg = bg.slice(0, -3);

    percentageValueText = `${Math.floor(val)}%`;
    if (percentageValueText.length === 2) {
      percentageValueText = " " + percentageValueText;
    }
  }

  return `${boundaryStartCharacter}${fg}${bg}${percentageValueText}${boundaryEndCharacter}`;
}

function getTimingStatsForSpecs({ specs = [], binSize, slowThreshold } = {}) {
  const numberOfBins = slowThreshold / binSize;
  let slowTestCount = 0;

  const histogram = {};

  for (let i = 0; i < numberOfBins; i++) {
    histogram[i] = 0;
  }

  for (let i = 0; i < specs.length; i++) {
    const targetBin = Math.floor(specs[i].timeInMilliseconds / binSize);
    if (targetBin >= numberOfBins) {
      slowTestCount++;
    } else {
      histogram[targetBin]++;
    }
  }

  return {
    histogram,
    slowTestCount,
    binSize,
    slowThreshold
  };
}

function printTimingStats({
  histogram,
  totalCount,
  binSize,
  slowTestCount,
  slowThreshold
} = {}) {
  const keys = Object.keys(histogram);
  const printableData = [];

  for (let i = 0; i < keys.length; i++) {
    const start = parseInt(keys[i]) * binSize;
    const end = start + binSize;
    const count = histogram[keys[i]];
    const binRange = `${start}-${end}`;
    const unit = "ms";

    printableData.push({
      range: `[${binRange}${unit}]`,
      count,
      percentageBar: percentageBar((count / totalCount) * 100)
    });
  }

  const type = slowTestCount > 0 ? "warn" : "info";

  printableData.push({
    range: textFormat(`[>${slowThreshold}ms]`, { type }),
    count: textFormat(slowTestCount, { type }),
    percentageBar: textFormat(
      percentageBar((slowTestCount / totalCount) * 100),
      { type }
    )
  });

  console.log(
    columnify(printableData, {
      showHeaders: false,
      config: {
        range: { minWidth: 12 },
        count: { minWidth: 4 }
      }
    })
  );
}

function reportSlowestTests({
  specs = [],
  longestTestsCount = 0,
  slowThreshold
} = {}) {
  const slowestSpecs = specs
    .sort(function(a, b) {
      return a.timeInMilliseconds < b.timeInMilliseconds ? 1 : -1;
    })
    .slice(0, longestTestsCount);

  const printableData = slowestSpecs.map(spec => {
    const type = spec.timeInMilliseconds >= slowThreshold ? "warn" : "info";

    return {
      time: textFormat(`${spec.timeInMilliseconds}ms`, { type }),
      name: textFormat(`${spec.name}`, { type })
    };
  });

  console.log(columnify(printableData, { showHeaders: false }));
}

const TimeStatsReporter = function(baseReporterDecorator, config) {
  baseReporterDecorator(this);

  const reporterOptionsKey = "timeStatsReporter";
  const reporterOptions = Object.assign(
    defaultReporterOptions,
    config[reporterOptionsKey]
  );

  const specs = [];

  this.onSpecComplete = function(browser, result) {
    const name = result.suite.join(" ") + " " + result.description;

    specs.push({
      browser: browser.name,
      name: name,
      timeInMilliseconds: result.time,
      slowThreshold: reporterOptions.slowThreshold
    });
  };

  this.onRunComplete = function(browsers, _results) {
    if (reporterOptions.reportTimeStats) {
      console.log("\nTest Time Stats");
      const {
        histogram,
        binSize,
        slowTestCount,
        slowThreshold
      } = getTimingStatsForSpecs({
        specs,
        binSize: reporterOptions.binSize,
        slowThreshold: reporterOptions.slowThreshold
      });
      printTimingStats({
        histogram,
        totalCount: specs.length,
        binSize,
        slowTestCount,
        slowThreshold
      });
    }

    if (reporterOptions.reportSlowestTests) {
      console.log("\nSlowest Tests");
      reportSlowestTests({
        singleBrowser: browsers.length === 1,
        specs,
        slowThreshold: reporterOptions.slowThreshold,
        longestTestsCount: reporterOptions.longestTestsCount
      });
    }
  };
};

TimeStatsReporter.$inject = ["baseReporterDecorator", "config"];

module.exports = {
  "reporter:time-stats": ["type", TimeStatsReporter],
  getTimingStatsForSpecs,
  printTimingStats
};