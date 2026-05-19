const POKEMON_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=1500";

const difficultySettings = {
    easy: {
        pairs: 3,
        time: 50,
        columns: 3,
        label: "TRAINER FILE"
    },
    medium: {
        pairs: 6,
        time: 45,
        columns: 4,
        label: "GYM LEADER FILE"
    },
    hard: {
        pairs: 8,
        time: 35,
        columns: 4,
        label: "RIVAL FILE"
    }
};

const gameGrid = document.querySelector("#game_grid");
const difficultySelect = document.querySelector("#difficulty");
const themeSelect = document.querySelector("#theme");
const startButton = document.querySelector("#start_button");
const resetButton = document.querySelector("#reset_button");
const powerButton = document.querySelector("#power_button");
const messageBox = document.querySelector("#message");

const currentTimeText = document.querySelector("#current_time");
const timeLeftText = document.querySelector("#time_left");
const clickCountText = document.querySelector("#click_count");
const pairsLeftText = document.querySelector("#pairs_left");
const pairsMatchedText = document.querySelector("#pairs_matched");
const totalPairsText = document.querySelector("#total_pairs");

let pokemonList = [];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let gameActive = false;
let timerId = null;
let clockId = null;
let powerUsed = false;

const state = {
    clicks: 0,
    pairsLeft: 0,
    pairsMatched: 0,
    totalPairs: 0,
    timeLeft: 0
};

function updateClock()
{
    currentTimeText.textContent = new Date().toLocaleTimeString();
}

function startClock()
{
    updateClock();

    if (!clockId)
    {
        clockId = setInterval(updateClock, 1000);
    }
}

function setMessage(text, type = "")
{
    messageBox.textContent = text;
    messageBox.className = `game-message ${type}`.trim();
}

function updateStatus()
{
    timeLeftText.textContent = state.timeLeft;
    clickCountText.textContent = state.clicks;
    pairsLeftText.textContent = state.pairsLeft;
    pairsMatchedText.textContent = state.pairsMatched;
    totalPairsText.textContent = state.totalPairs;
}

function applyTheme(theme)
{
    document.body.classList.remove(
        "theme-light",
        "theme-dark",
        "theme-corrupt"
    );

    document.body.classList.add(`theme-${theme}`);
}

function shuffle(items)
{
    const copiedItems = [...items];

    for (let i = copiedItems.length - 1; i > 0; i--)
    {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [copiedItems[i], copiedItems[randomIndex]] =
            [copiedItems[randomIndex], copiedItems[i]];
    }

    return copiedItems;
}

async function loadPokemonList()
{
    if (pokemonList.length > 0)
    {
        return pokemonList;
    }

    const response = await fetch(POKEMON_LIST_URL);

    if (!response.ok)
    {
        throw new Error("Could not load the PokéAPI archive.");
    }

    const data = await response.json();
    pokemonList = data.results;

    return pokemonList;
}

async function getPokemonDetails(url)
{
    const response = await fetch(url);

    if (!response.ok)
    {
        throw new Error("Could not load a Pokémon signal.");
    }

    const pokemon = await response.json();

    const officialArtwork =
        pokemon.sprites?.other?.["official-artwork"]?.front_default;

    const fallbackImage = pokemon.sprites?.front_default;
    const image = officialArtwork || fallbackImage;

    if (!image)
    {
        return null;
    }

    return {
        id: pokemon.id,
        name: pokemon.name,
        image: image
    };
}

async function getRandomPokemonSet(pairCount)
{
    const list = await loadPokemonList();
    const randomizedList = shuffle(list);
    const selectedPokemon = [];

    for (const pokemon of randomizedList)
    {
        if (selectedPokemon.length === pairCount)
        {
            break;
        }

        try
        {
            const details = await getPokemonDetails(pokemon.url);

            if (details)
            {
                selectedPokemon.push(details);
            }
        }
        catch (error)
        {
            console.warn(error);
        }
    }

    if (selectedPokemon.length < pairCount)
    {
        throw new Error("Not enough Pokémon images could be loaded.");
    }

    return selectedPokemon;
}

function makeDeck(pokemonSet)
{
    const pairedCards = pokemonSet.flatMap(function (pokemon)
    {
        return [
            {
                ...pokemon,
                cardId: `${pokemon.id}-a`
            },
            {
                ...pokemon,
                cardId: `${pokemon.id}-b`
            }
        ];
    });

    return shuffle(pairedCards);
}

function formatPokemonName(name)
{
    return name
        .split("-")
        .map(function (word)
        {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

function createCard(cardData)
{
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.dataset.pokemonId = cardData.id;
    card.dataset.cardId = cardData.cardId;
    card.setAttribute("aria-label", `Hidden ${cardData.name} card`);

    const displayName = formatPokemonName(cardData.name);

    card.innerHTML = `
        <div class="card-inner">
            <div class="card-face card-back">
                <span class="back-symbol">?</span>
            </div>

            <div class="card-face card-front">
                <img
                    src="${cardData.image}"
                    alt="${displayName}"
                >
                <span class="pokemon-name">
                    ${displayName}
                </span>
            </div>
        </div>
    `;

    card.addEventListener("click", handleCardClick);

    return card;
}

function renderDeck(deck, columns)
{
    gameGrid.innerHTML = "";
    gameGrid.style.setProperty("--columns", columns);

    for (const cardData of deck)
    {
        gameGrid.append(createCard(cardData));
    }
}

function startTimer()
{
    clearInterval(timerId);

    timerId = setInterval(function ()
    {
        state.timeLeft -= 1;
        updateStatus();

        if (state.timeLeft <= 0)
        {
            endGame(false);
        }
    }, 1000);
}

function resetCardSelection()
{
    firstCard = null;
    secondCard = null;
}

function flipCard(card)
{
    card.classList.add("is-flipped");
}

function unflipCards(cardOne, cardTwo)
{
    setTimeout(function ()
    {
        cardOne.classList.remove("is-flipped");
        cardTwo.classList.remove("is-flipped");

        resetCardSelection();
        lockBoard = false;
    }, 900);
}

function markCardsMatched(cardOne, cardTwo)
{
    cardOne.classList.add("is-matched");
    cardTwo.classList.add("is-matched");

    cardOne.disabled = true;
    cardTwo.disabled = true;

    state.pairsMatched += 1;
    state.pairsLeft -= 1;
    updateStatus();

    resetCardSelection();
    lockBoard = false;

    if (state.pairsLeft === 0)
    {
        endGame(true);
    }
}

function handleCardClick(event)
{
    const clickedCard = event.currentTarget;

    if (!gameActive)
    {
        return;
    }

    if (lockBoard)
    {
        return;
    }

    if (clickedCard === firstCard)
    {
        return;
    }

    if (clickedCard.classList.contains("is-matched"))
    {
        return;
    }

    if (clickedCard.classList.contains("is-flipped"))
    {
        return;
    }

    state.clicks += 1;
    updateStatus();
    flipCard(clickedCard);

    if (!firstCard)
    {
        firstCard = clickedCard;
        return;
    }

    secondCard = clickedCard;
    lockBoard = true;

    const isMatch =
        firstCard.dataset.pokemonId === secondCard.dataset.pokemonId;

    if (isMatch)
    {
        setTimeout(function ()
        {
            markCardsMatched(firstCard, secondCard);
        }, 450);

        return;
    }

    unflipCards(firstCard, secondCard);
}

function disableAllCards()
{
    const cards = document.querySelectorAll(".card");

    for (const card of cards)
    {
        card.disabled = true;
    }
}

function endGame(didWin)
{
    gameActive = false;
    lockBoard = true;
    clearInterval(timerId);
    disableAllCards();
    powerButton.disabled = true;

    document.body.classList.remove("game-over", "game-won");

    if (didWin)
    {
        document.body.classList.add("game-won");
        setMessage(
            `File restored. You won with ${state.clicks} clicks and ${state.timeLeft} seconds left.`,
            "win"
        );

        return;
    }

    document.body.classList.add("game-over");
    state.timeLeft = 0;
    updateStatus();
    setMessage(
        "Game over. The signal collapsed before every pair was recovered.",
        "lose"
    );
}

async function startGame()
{
    const difficulty = difficultySelect.value;
    const settings = difficultySettings[difficulty];

    gameActive = false;
    lockBoard = true;
    powerUsed = false;
    resetCardSelection();
    clearInterval(timerId);
    document.body.classList.remove("game-over", "game-won");

    state.clicks = 0;
    state.pairsMatched = 0;
    state.totalPairs = settings.pairs;
    state.pairsLeft = settings.pairs;
    state.timeLeft = settings.time;

    updateStatus();
    powerButton.disabled = true;
    setMessage("Searching the corrupted PokéAPI archive...");

    try
    {
        const pokemonSet = await getRandomPokemonSet(settings.pairs);
        const deck = makeDeck(pokemonSet);

        renderDeck(deck, settings.columns);

        gameActive = true;
        lockBoard = false;
        powerButton.disabled = false;
        startTimer();

        setMessage(
            `${settings.label} opened. Recover all pairs before the file decays.`
        );
    }
    catch (error)
    {
        console.error(error);
        gameActive = false;
        lockBoard = true;
        setMessage(
            "The PokéAPI signal failed. Check your connection and try again.",
            "error"
        );
    }
}

function resetGame()
{
    startGame();
}

function triggerPowerUp()
{
    if (!gameActive || powerUsed || lockBoard)
    {
        return;
    }

    powerUsed = true;
    powerButton.disabled = true;
    lockBoard = true;

    const unmatchedCards = document.querySelectorAll(
        ".card:not(.is-matched)"
    );

    for (const card of unmatchedCards)
    {
        card.classList.add("is-peeking");
    }

    setMessage(
        "Signal Booster active. All unmatched cards are visible for 3 seconds."
    );

    setTimeout(function ()
    {
        for (const card of unmatchedCards)
        {
            card.classList.remove("is-peeking");
        }

        resetCardSelection();
        lockBoard = false;
        setMessage("Signal Booster jammed. The signal is unstable again.");
    }, 3000);
}

startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);
powerButton.addEventListener("click", triggerPowerUp);

themeSelect.addEventListener("change", function ()
{
    applyTheme(themeSelect.value);
});

difficultySelect.addEventListener("change", function ()
{
    setMessage("Memory Card changed. Press Start to begin again.");
});

startClock();
updateStatus();
applyTheme(themeSelect.value);
