"use strict";

/**
 * InvestmentStrategy is our individual in the population.
 * @constructor
 */
class InvestmentStrategy
{
    constructor(strategy, fitness)
    {
        // a strategy is a dictionary that looks like { 'Asset1': 4, 'Asset2': 7, 'Asset3': 1 }
        // it means "buy 4 shares of Asset1, 7 shares of Asset2, 1 share of Asset3"
        // this is our "chromosome"
        this.strategy = strategy;

        // how different we will be from the ideal asset percentage
        // if we buy the amount of resources specified by the strategy
        this.fitness = fitness;
    }
}

class AssetData
{
    /**
     * Constructor
     * @param {BigNumber} targetPercentage Target percentage of asset
     * @param {BigNumber} currentTotalValue Current total asset value
     * @param {BigNumber} currentSharePrice Current price of 1 share of asset
     */
    constructor(targetPercentage, currentTotalValue, currentSharePrice)
    {
        this.targetPercentage = targetPercentage;
        this.currentTotalValue = currentTotalValue;
        this.currentSharePrice = currentSharePrice;
    }
}

class StrategyData
{
    constructor(assetName, targetPercentage, currentTotalValue, currentSharePrice,
        currentPercentage, sharesCount, rebalancedPercentage, projectedInvestment)
    {
        this.assetName = assetName;
        this.targetPercentage = targetPercentage;
        this.currentTotalValue = currentTotalValue;
        this.currentSharePrice = currentSharePrice;
        this.currentPercentage = currentPercentage;
        this.sharesCount = sharesCount;
        this.rebalancedPercentage = rebalancedPercentage;
        this.projectedInvestment = projectedInvestment;
    }
}

class Utility
{
    /**
    * Calculates total assets value
    * by summing up separate asset values
    * @param {Map<string, AssetData>} assetData Asset data as a map
    * @return {BigNumber} Sum of all asset values
    */
    static sumCurrentAssetValues(assetData)
    {
        const currentTotalValues = new Map();
        assetData.forEach((assetData, assetName) => currentTotalValues.set(assetName, assetData.currentTotalValue));
        return Utility.sumMoney(currentTotalValues);
    }

    /**
     * Calculates total sum of money for all assets
     * @param {Map<string, BigNumber>} moneyPerAsset Money values per asset
     * @returns {BigNumber} Sum of all asset values
     */
    static sumMoney(moneyPerAsset)
    {
        return Array.from(moneyPerAsset.values()).reduce((partialSum, a) => partialSum.plus(a), new BigNumber(0));
    }

    /**
     * Calculates projected investment per asset,
     * for example, if we're going to buy 2 shares of asset A,
     * and its current price per share is 4.5,
     * projected investment for A will be 4.5 * 2 = 9
     * @param {Map<string, BigNumber>} strategy Asset names and share buying counts as a map
     * @param {Map<string, AssetData>} assetData Asset data as a map
     * @returns {Map<string, BigNumber>} Projected investments
     */
    static calculateProjectedInvestmentPerAsset(strategy, assetData)
    {
        let projectedInvestmentPerAsset = new Map();

        const assetNames = strategy.keys();
        for(const assetName of assetNames)
        {
            const assetCount = strategy.get(assetName);
            const currentSharePrice = assetData.get(assetName).currentSharePrice;
            projectedInvestmentPerAsset.set(assetName, currentSharePrice.multipliedBy(assetCount));
        }
        return projectedInvestmentPerAsset;
    }

    /**
     * Calculates stats based on strategy, things like
     * rebalanced percentages, projected investments, etc
     * @param {Map<string, int>} strategy Asset names and share buying counts as a map 
     * @param {Map<string, AssetData>} assetData Asset data as a map
     * @returns {StrategyData[]} Array of assets in strategy for displaying in a table
     */
    static calculateStrategyStats(strategy, assetData)
    {
        let stats = [];

        const currentTotalValueSum = Utility.sumCurrentAssetValues(assetData);
        const projectedInvestments = Utility.calculateProjectedInvestmentPerAsset(strategy, assetData);
        const totalProjectedInvestment = Utility.sumMoney(projectedInvestments);
        const currentTotalValueAndProjectedInvestmentSum = currentTotalValueSum.plus(totalProjectedInvestment);
        const _100 = new BigNumber(100); // 100%
        for(const assetName of strategy.keys())
        {
            const asset = assetData.get(assetName);
            const projectedAssetValue = asset.currentTotalValue.plus(projectedInvestments.get(assetName));

            stats.push(new StrategyData(
                assetName, 
                asset.targetPercentage,
                asset.currentTotalValue,
                asset.currentSharePrice,
                currentTotalValueSum.isZero() ? 
                    new BigNumber(0) : 
                    asset.currentTotalValue.dividedBy(currentTotalValueSum).multipliedBy(_100),
                strategy.get(assetName),
                currentTotalValueAndProjectedInvestmentSum.isZero() ? 
                    new BigNumber(0) : 
                    projectedAssetValue.dividedBy(currentTotalValueAndProjectedInvestmentSum).multipliedBy(_100),
                projectedInvestments.get(assetName)
            ));
        }
        return { stats: stats, totalProjectedInvestment: totalProjectedInvestment };
    }
}

class InvestmentStrategyManager
{
    /**
     * Sets random asset count between 0 and whatever can possibly be bought with investmentLimit to a strategy
     * @param {Map<string, int>} strategy Investment strategy as a Map<assetName, sharesCount>
     * @param {string} assetName Asset name
     * @param {Map<string, AssetData>} assetData Asset data as a map
     * @param {BigNumber} investmentLimit Our today's investment limit
     */
    static setRandomSharesCountForAssetToStrategy(strategy, assetName, assetData, investmentLimit)
    {
        const currentSharePrice = assetData.get(assetName).currentSharePrice;

        // get the integer number of the division, equivalent to Math.floor(investmentLimit / currentSharePrice)
        const maxSharesCountPossibleToBuy = investmentLimit.dividedToIntegerBy(currentSharePrice).toNumber();

        // Math.random only returns numbers between 0 and 1,
        // to make it return numbers between 0 and max, we multiply by max
        const randomShareCount = Math.round(Math.random() * maxSharesCountPossibleToBuy);
        strategy.set(assetName, randomShareCount);
    }

    /**
    * Creates investment strategy with random share counts
    * @param {Map<string, AssetData>} assetData Asset data as a map
    * @param {BigNumber} investmentLimit Our today's investment limit
    */
    static createStrategy(assetData, investmentLimit)
    {
        let strategy = new Map();
        const assetNames = assetData.keys();
        for(const assetName of assetNames)
        {
            InvestmentStrategyManager.setRandomSharesCountForAssetToStrategy(strategy, assetName, assetData, investmentLimit);
        }
        return strategy;
    }

    /**
    * Mates 2 investment strategies (for every asset, picks either share count
    * from parent 1 or from parent 2, or in some cases a new randomly generated
    * count)
    * @param {Map<string, int>} parent1 First parent strategy
    * @param {Map<string, int>} parent2 Second parent strategy
    * @param {Map<string, AssetData>} assetData Asset data as a map
    * @param {BigNumber} investmentLimit Our today's investment limit
    */
    static mateStrategies(parent1, parent2, assetData, investmentLimit)
    {
        let childStrategy = new Map();
        const assetNames = assetData.keys();
        for(const assetName of assetNames)
        {
            const probability = Math.random();

            // if probability is less than 0.4, insert gene from parent 1
            if(probability < 0.4)
            {
                childStrategy.set(assetName, parent1.get(assetName));
            }
            // if probability is between 0.4 and 0.6, mutate gene
            else if(probability < 0.6)
            {
                InvestmentStrategyManager.setRandomSharesCountForAssetToStrategy(childStrategy, assetName, assetData, investmentLimit);
            }
            // if probability is more than 0.6, insert gene from parent 2
            else
            {
                childStrategy.set(assetName, parent2.get(assetName));
            }
        }
        return childStrategy;
    }

    /**
     * Calculates investment strategy fitness
     * @param {Map<string, int>} strategy Investment strategy as a Map<assetName, sharesCount>
     * @param {Map<string, AssetData>} assetData Asset data as a map
     * @param {BigNumber} investmentLimit Our today's investment limit
     * 
     * @returns {BigNumber} Sum of differences between current asset percentages and
     * projected asset percentages, plus a percentage of investmentLimit left unspent 
     * if investment strategy is followed (the less this number is, the better)
     */
    static calculateStrategyFitness(strategy, assetData, investmentLimit)
    {
        // check if we're not exceeding investment limit
        let projectedInvestments = Utility.calculateProjectedInvestmentPerAsset(strategy, assetData);
        let totalProjectedInvestment = Utility.sumMoney(projectedInvestments);
        if(totalProjectedInvestment.comparedTo(investmentLimit) === 1) // totalProjectedInvestment > investmentLimit
        {
            return new BigNumber(Number.MAX_VALUE); // if we exceed investment limit, fitness is minimal
        }

        // now check percentage differences and amount of money left unspent
        // if the strategy is followed through
        let currentTotalValue = Utility.sumCurrentAssetValues(assetData);
        const projectedTotalValue = currentTotalValue.plus(totalProjectedInvestment);
        let totalDiffFromTargetPercentage = new BigNumber(0);
        const _100 = new BigNumber(100); // 100%
        for(const assetName of strategy.keys())
        {
            const newAssetValue = assetData.get(assetName).currentTotalValue.plus(projectedInvestments.get(assetName));
            const newAssetPercentage = newAssetValue.dividedBy(projectedTotalValue).multipliedBy(_100);
            const diffFromTargetPercentage = assetData.get(assetName).targetPercentage.minus(newAssetPercentage).absoluteValue();
            totalDiffFromTargetPercentage = totalDiffFromTargetPercentage.plus(diffFromTargetPercentage);
        }
        const diffFromInvestmentLimitPercentage = _100.minus(totalProjectedInvestment.dividedBy(investmentLimit).multipliedBy(_100));
        return totalDiffFromTargetPercentage.plus(diffFromInvestmentLimitPercentage);
    }
}

class StrategyPopulationManager
{
    /**
     * Runs genetic algorithm for determining the best investment strategy in a Web Worker thread
     * @param {BigNumber} populationSize Size of the population for the genetic algorithm
     * @param {int} stopAfterNGenerationsWithoutBetterResult We can't guarantee perfect investment strategy with best fitness,
     *                                                       so stop after N generations without finding a better result
     * @param {Map<string, AssetData>} assetData Asset data as a map
     * @param {BigNumber} investmentLimit Our today's investment limit
     * @param {method(message)} callback Callback method to signal that we found a new solution, either intermediate or final
     */
    static runWorker(populationSize, stopAfterNGenerationsWithoutBetterResult, assetData, investmentLimit, callback)
    {
        let generation = 1; // current generation
        let population = [];
        let lastNBestFitnesses = [];

        while(true)
        {
            if(generation === 1)
            {
                // create initial population
                for(let i = 0; i < populationSize; i++)
                {
                    const strategy = InvestmentStrategyManager.createStrategy(assetData, investmentLimit);
                    const fitness = InvestmentStrategyManager.calculateStrategyFitness(strategy, assetData, investmentLimit);
                    population.push(new InvestmentStrategy(strategy, fitness));
                }
            }
            else
            {
                // create new generation
                let newGeneration = [];

                // promote 10% of fittest population to the next generation
                let s = Math.floor((10 * populationSize) / 100);
                newGeneration.push(...population.slice(0, s));

                // mate 50% of the fittest population to produce offspring
                s = Math.floor((90 * populationSize) / 100);
                const half = Math.floor((50 * populationSize) / 100);
                for(let i = 0; i < s; i++)
                {
                    const populationHalf = population.slice(0, half);
                    const parent1 = populationHalf[Math.floor(Math.random() * populationHalf.length)];
                    const parent2 = populationHalf[Math.floor(Math.random() * populationHalf.length)];
                    const child = InvestmentStrategyManager.mateStrategies(parent1.strategy, parent2.strategy, assetData, investmentLimit);
                    const fitness = InvestmentStrategyManager.calculateStrategyFitness(child, assetData, investmentLimit);
                    newGeneration.push(new InvestmentStrategy(child, fitness));
                }
                population = newGeneration;
            }

            // sort the population in increasing order of fitness score
            population.sort((a, b) => a.fitness.comparedTo(b.fitness));

            // append the fitness of the most fit strategy to the list of fitnesses
            // and truncate the list to stopAfterNGenerationsWithoutBetterResult members
            lastNBestFitnesses.push(population[0].fitness);
            lastNBestFitnesses.splice(0, lastNBestFitnesses.length - stopAfterNGenerationsWithoutBetterResult);

            if(StrategyPopulationManager.stop(lastNBestFitnesses, stopAfterNGenerationsWithoutBetterResult))
            {
                break;
            }

            callback({ generation: generation, result: population[0] });

            generation += 1;

        }
        callback({ generation: generation,
            result: population[0],
            strategyStats: Utility.calculateStrategyStats(population[0].strategy, assetData),
            investmentLimit: investmentLimit });
    }

    /**
     * Decides if genetic algorithm needs to be stopped
     * @param {BigNumber[]} lastNBestFitnesses Array of last N best fitnesses found by the algorithm
     * @param {int} stopAfterNGenerationsWithoutBetterResult We can't guarantee perfect investment strategy with best fitness,
     *                                                       so stop after N generations without finding a better result
     * @returns {boolean} true if the algorithm needs to stop, false otherwise
     */
    static stop(lastNBestFitnesses, stopAfterNGenerationsWithoutBetterResult)
    {
        // reached an ideal fitness of zero, stop
        return lastNBestFitnesses.length > 0 && lastNBestFitnesses[lastNBestFitnesses.length - 1].isZero()
            ||
            // an array of best fitnesses is full of identical fitnesses, stop
            lastNBestFitnesses.length >= stopAfterNGenerationsWithoutBetterResult && 
            lastNBestFitnesses[0].comparedTo(lastNBestFitnesses[lastNBestFitnesses.length - 1]) === 0;
    }
}