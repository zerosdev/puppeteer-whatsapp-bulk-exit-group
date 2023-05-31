const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

var args = []
process.argv.slice(2).forEach(function (val, index, array) {
    let a = val.split('=')
    args[a[0]] = a[1]
})

if (!args.hasOwnProperty('title') || args.title.length === 0) {
    console.error('ERROR: Please specify the `title`')
    return
}

const title = args.title;

(async () => {
    let repeat = true
    let args = [
        '--disable-gpu',
        '--single-process',
        '--enable-automation',
        '--start-maximized',
        '--no-sandbox',
        '--disable-web-security',
    ]
    const browser = await puppeteer.launch({
        headless: false,
        args: args
    })
    const [page] = await browser.pages();
    await page.goto('https://web.whatsapp.com', { waitUntil: ['domcontentloaded', 'networkidle0'] })
    await page.waitForXPath('//div[@data-testid="qrcode"]', { timeout: 120000 })
    await page.waitForXPath('//div[@data-testid="chat-list"]', { timeout: 120000 })

    do {
        console.info("Cari `" + title + "`")

        let [searchColumn] = await page.$x('//div[@data-testid="chat-list-search"]')

        await searchColumn.click()
        await page.waitForTimeout(500)

        await page.keyboard.down('ControlLeft')
        await page.keyboard.press('KeyA')
        await page.keyboard.up('ControlLeft')
        await page.keyboard.press('Backspace')

        await searchColumn.type(title, { delay: 50 })

        await page.waitForTimeout(500)

        if ((await page.$x('//div[@id="side"]//svg[contains(@class, "gdrnme8s hbnrezoj f8mos8ky tkmeqcnu b9fczbqn")]')).length > 0) {
            console.info('Menunggu loading selesai...')
            await page.waitForXPath('//div[@id="side"]//svg[contains(@class, "gdrnme8s hbnrezoj f8mos8ky tkmeqcnu b9fczbqn")]', { hidden: true })
        }

        await page.waitForTimeout(1000)

        let chats = await page.$x('//div[@data-testid="chat-list"]//span[@data-testid="default-group"]')

        if (!Array.isArray(chats)) {
            console.info("Tidak dapat mengambil chat")
            repeat = false
            break
        }

        if (chats.length === 0) {
            console.info("Chat tidak ditemukan")
            repeat = false
            break
        }

        let exit = 0
        let index = 0

        await chats.reduce(async (previous, chat) => {
            await previous
            let currentIndex = index
            index++
            try {
                let [root] = await chat.$x(`.//ancestor::div[@data-testid="list-item-${currentIndex}"]`)

                if (root === undefined) {
                    return
                }

                await root.evaluate(el => el.scrollIntoView())
                await page.waitForTimeout(500)
                let [groupTitle] = await root.$x('//span[@dir="auto"]')

                if (groupTitle === undefined) {
                    console.error("`groupTitle` undefined. Skip to the next group")
                    return
                }

                groupTitle = await groupTitle.evaluate(el => el.getAttribute('title'))

                let re = new RegExp(title, 'gi')
                if (!re.test(groupTitle)) {
                    console.info("`groupTitle` not match. Skip to the next group")
                    return
                }

                do {
                    try {
                        await root.hover()
                    } catch (e) {
                        if (! /detached/gi.test(e.message)) {
                            console.error(e)
                        }
                        break
                    }
                    await page.waitForTimeout(500)
                    await root.click({
                        button: 'right'
                    })
                    await page.waitForTimeout(500)
                    await page.waitForXPath('//li[@data-testid="mi-delete"]')
                    let [deleteButton] = await page.$x('//li[@data-testid="mi-delete"]')
                    await deleteButton.click()
                    await page.waitForTimeout(500)
                    await page.waitForXPath('//button[@data-testid="popup-controls-ok"]')
                    let [confirm] = await page.$x('//button[@data-testid="popup-controls-ok"]')
                    await confirm.click()
                    await page.waitForTimeout(500)

                    if ((await page.$x('//button[@data-testid="popup-controls-ok"]')).length > 0) {
                        let [confirm2] = await page.$x('//button[@data-testid="popup-controls-ok"]')
                        if (confirm2) {
                            await confirm2.click()
                            await page.waitForTimeout(500)
                        }
                    }

                    await page.waitForXPath('//button[@data-testid="popup-controls-ok"]', { hidden: true })
                    await page.waitForTimeout(500)
                } while ((await chat.$x(`.//ancestor::div[@data-testid="list-item-${currentIndex}"]`)).length > 0)

                exit++
                console.log("Keluar & hapus grup `" + groupTitle + "`")
                await page.waitForTimeout(1000)
            } catch (e) {
                console.error(e)
                repeat = false
            }
        }, Promise.resolve())

        if (exit > 0) {
            console.log("Berhasil keluar dari " + exit + " grup")
        }

        if (repeat) {
            console.log("Mengulangi proses grup lainnya...")
            await page.waitForTimeout(2000)
        }
    } while (repeat === true)

    // logout wa & close browser
    let [menu] = await page.$x('//span[@data-testid="menu"]')
    await menu.click()
    await page.waitForTimeout(500)
    await page.waitForXPath('//li[@data-testid="mi-logout menu-item"]', { visible: true })
    let [logout] = await page.$x('//li[@data-testid="mi-logout menu-item"]')
    await logout.click()
    await page.waitForTimeout(500)
    await page.waitForXPath('//button[@data-testid="popup-controls-ok"]')
    let [confirm] = await page.$x('//button[@data-testid="popup-controls-ok"]')
    await confirm.click()
    await page.waitForXPath('//div[@data-testid="qrcode"]')
    await browser.close()
})()
