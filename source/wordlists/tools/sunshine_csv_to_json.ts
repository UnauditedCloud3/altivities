import fs from "fs/promises"
import Kuroshiro from "kuroshiro"
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji"
import CSV from "csvtojson"

/**
 * This is a helper file I made to help me convert CSVs in a certain format to
 * JSON wordlists.
 *
 * This is specifically for Sunshine CSVs, to help add extra answers and clean up
 * some things to a format I prefer.
 *
 * Kuroshiro https://www.npmjs.com/package/kuroshiro
 * This is a package that converts kanji to hiragana for me.
 */

type Languages =
    | "en"
    | "ja"

type Word = {
    [T in Exclude<Languages, "ja">]: string | string[]
} & {
    ja: {
        kanji: string
        hiragana: string
    } | {
        kanji: string
        hiragana: string
    }[]
}

type Wordlist = Word[]

const kuroshiro = new Kuroshiro()

async function toHiragana(kanjiString: string) {
    let hiragana = Kuroshiro.Util.kanaToHiragna(await kuroshiro.convert(kanjiString, { to: "hiragana" })) as string
    hiragana = hiragana
        .replace("かこがた", "かこけい")
        .replace("1にん", "ひとり")
        .replace("いなていけい", "ひていけい")
        .replace("へんかがた", "へんかけい")
        .replace("ふくすうがた", "ふくすうけい")
    return hiragana
}

async function run() {
    await kuroshiro.init(new KuromojiAnalyzer())
    const input = (await fs.readFile("C:\\Users\\Hyprk\\ownCloud\\Work\\Jet Programme\\サンシャイン Sunshine\\Grade 1\\Sunshine 1 wordlist.csv")).toString("utf-8")

    const words: Wordlist = []
    for (const csvWord of await CSV({ delimiter: "," }).fromString(input)) {
        if (csvWord.unit !== "9") continue

        const original_en = (csvWord.english as string)
            .trim()
            .replace("’", "'")
            .replace("．", ".")
            .replace("（", "(")
            .replace("）", ")")
            .replace("［", "[")
            .replace("］", "]")
            .replace("…", "...")
            .replace(/，\s*/, ", ")
            .replace("～", "~")
            .replace(/\s*＝\s*/, " = ")
            .replace(/\s*\.\.\./, " ...")
        const original_ja = (csvWord.japanese as string)
            .trim()
            .replace(/\s*＝\s*/, " = ")

        const en: string[] = []
        const ja: {
            kanji: string
            hiragana: string
        }[] = []

        if (original_en.endsWith("(s)") || original_en.endsWith("(es)")) {
            // Accept both the plural and singular, too
            const singular = original_en.replace(/\(.+?\)$/, "")
            const plural = original_en.replace(/[()]/g, "")
            en.push(singular, plural, original_en)
        } else if (original_en.endsWith("(ing)")) {
            // Disregard the 'ing', because the Japanese word is the base verb
            const base = original_en.replace(/\(.+?\)$/, "")
            en.push(base, original_en)
        } else if (/^[a-zA-Z]e\s+[a-z][A-Z]ing$/.test(original_en)) {
            // The base and ing forms are together, allow either the base, or both
            const words = original_en.split(" ")
            en.push(words[0], original_en, `${words[1]} ${words[0]}`)
        } else if (original_en.endsWith("(ed)") || original_en.endsWith("(d)")) {
            // Disregard the 'ed', because the Japanese word is the present tense
            const base = original_en.replace(/\(.+?\)$/, "")
            en.push(base, original_en)
        } else if (original_en.endsWith("~")) {
            // Accept with or without the tilde
            const no_tilde = original_en.replace(/\s*~$/, "")
            en.push(original_en, no_tilde)
        } else if (/^.+y\s+.+ies$/.test(original_en)) {
            // The singular and plural are together, allow either singular, plural, or both
            const words = original_en.split(" ")
            en.push(words[0], words[1], original_en, `${words[1]} ${words[0]}`)
        } else if (/\(.+?\)$/.test(original_en)) {
            // It has some other weird ending (e.g.: "whee(-ee)")
            const base = original_en.replace(/\(.+?\)$/, "")
            en.push(base, original_en)
        } else {
            // Normal vocabulary, just add the word
            en.push(original_en)
        }

        if (/.+?=.+?/.test(original_ja) && original_en.includes("'")) {
            // The english word is a contraction
            const answer = original_ja.replace(/.+?=\s*/, "") + "の省略"
            ja.push({
                "hiragana": await toHiragana(answer),
                "kanji": answer
            })
        } else {
            ja.push({
                "hiragana": await toHiragana(original_ja),
                "kanji": original_ja
            })
        }

        const word: Word = {
            "en": en.length == 1 ? en[0] : en,
            "ja": ja.length == 1 ? ja[0] : ja
        }
        words.push(word)
    }
    const wordsJSON = JSON.stringify(words, null, 2)
    console.log(wordsJSON)
    await fs.writeFile("output.json", wordsJSON, "utf-8")
}

run()