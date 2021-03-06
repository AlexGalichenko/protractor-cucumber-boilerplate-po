const Page = require('./Page');
const parseTokens = require('./parseTokens.js');
class SeleniumPage extends Page {

    constructor(driver) {
        super(driver);
        this.driver = driver;
    }

    /**
     * Set instance of webdriver.
     * Need to be done before call getElement()
     * @param driver {WebDriver} - instance of webdriver
     * @return {SeleniumPage}
     */
    setDriver(driver) {
        this.driver = driver;
        return this
    }

    /**
     * Get element by key
     * @param {string} key - key
     * @return {Promise<any>} - webdriverIO element
     * @override
     */
    async getElement(path) {
        const tokens = parseTokens(path);
        const elementList = this.getElementList(tokens);
        const root = await this.driver.findElement({
            using: 'css selector',
            value: 'html'
        });
        const reducer = (frameworkElement, elementDefiniton) => this.getFrameworkElement(frameworkElement, elementDefiniton);
        return elementList.reduce(reducer, root);
    }
    getFrameworkElement(frameworkElement, elementDefiniton) {
        if (elementDefiniton.selectorType === 'js') return this.driver.findElement(this.getSelector(elementDefiniton));
        if (!elementDefiniton.token || !elementDefiniton.token.type) return this.getChildElement(frameworkElement, elementDefiniton);
        if (elementDefiniton.token.byIndex) return this.getElementFromCollectionByIndex(frameworkElement, elementDefiniton);
        if (elementDefiniton.token.byText) return this.getElementFromCollectionByText(frameworkElement, elementDefiniton);
    }

    async getChildElement(frameworkElement, elementDefiniton) {
        const selector = this.getSelector(elementDefiniton);
        const element = await frameworkElement;
        if (elementDefiniton.token.isThis) return element
        if (elementDefiniton.isCollection) return element.findElements(selector);
        if (element.length) return Promise.all(element.map(child => child.findElement(selector)))
        return element.findElement(selector)
    }

    
    async getElementFromCollectionByIndex(frameworkElement, elementDefiniton) {
        const collection = await this.getRootElement(frameworkElement, elementDefiniton);
        if (elementDefiniton.token.byExactIndex) return this.getElementFromCollectionByExactIndex(collection, elementDefiniton)
        if (elementDefiniton.token.byRangeBetween) return this.getElementsFromCollectionByIndexFilter(
            collection,
            (_, i) => i >= elementDefiniton.token.value.startIndex - 1 && i <= elementDefiniton.token.value.endIndex - 1
        )
        if (elementDefiniton.token.byRangeGreater) return this.getElementsFromCollectionByIndexFilter(
            collection,
            (_, i) => i > elementDefiniton.token.value.startIndex - 1
        )
        if (elementDefiniton.token.byRangeLess) return this.getElementsFromCollectionByIndexFilter(
            collection,
            (_, i) => i < elementDefiniton.token.value.endIndex - 1
        )
    }

    getElementFromCollectionByExactIndex(collection, elementDefiniton) {
        if (elementDefiniton.token.value === 'LAST') return collection[collection.length - 1]
        return collection[elementDefiniton.token.value - 1]
    }

    getElementsFromCollectionByIndexFilter(collection, filterFn) {
        return collection.filter(filterFn)
    }

    async getElementFromCollectionByText(frameworkElement, elementDefiniton) {
        const collection = await this.getRootElement(frameworkElement, elementDefiniton);
        if (elementDefiniton.token.byPartialText) return this.getElementFromCollectionByTextFilter(
            collection,
            elementDefiniton,
            text => text.includes(elementDefiniton.token.value)
        )
        if (elementDefiniton.token.byExactText) return this.getElementFromCollectionByTextFilter(
            collection,
            elementDefiniton,
            text => text === elementDefiniton.token.value
        )
        if (elementDefiniton.token.byRegExp) return this.getElementFromCollectionByTextFilter(
            collection,
            elementDefiniton,
            text => elementDefiniton.token.value.test(text)
        )
    }

    async getElementFromCollectionByTextFilter(collection, elementDefiniton, filterFn) {
        const isAll = elementDefiniton.token.hasAllModifier;
        return this.getElementByFilter(collection, isAll, filterFn);
    }

    async getElementByFilter(collection, isAll, filterFn) {
        let filteredCollection = [];
        for (const element of collection) {
            const text = await element.getText();
            if (filterFn(text)) filteredCollection.push(element)
        }
        if (isAll) return filteredCollection
        return filteredCollection[0]
    }

    getRootElement(frameworkElement, elementDefiniton) {
        const selector = this.getSelector(elementDefiniton);
        return !elementDefiniton.token.isThis ? frameworkElement.findElements(selector) : frameworkElement;
    }

    /**
     * Resolve element by location strategy
     * @param {Element|Collection|Component} element - element to get selector
     * @return {WebDriverLocator|Object} - by selector
     * @throws {Error}
     * @private
     */
    getSelector(element) {
        switch (element.selectorType) {
            case 'css': return {
                using: 'css selector',
                value: element.selector
            };
            case 'xpath': return {
                using: 'xpath',
                value: element.selector
            };
            //todo fix bug that will allow to pass params into function
            case 'js': return function(context) {
                const driver = context.driver_ ||context;
                return driver.executeScript.apply(driver, [element.selector]);
            };
            case 'android': return {
                using: '-android uiautomator',
                value: element.selector
            };
            case 'ios': return {
                using: '-ios uiautomation',
                value: element.selector
            };
            case 'accessibilityId': return {
                using: 'accessibility id',
                value: element.selector
            };
            default: throw new Error(`Selector type ${element.selectorType} is not defined`);
        }
    }

}

module.exports = SeleniumPage;
