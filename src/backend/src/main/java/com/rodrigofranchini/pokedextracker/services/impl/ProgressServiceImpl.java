package com.rodrigofranchini.pokedextracker.services.impl;

import com.rodrigofranchini.pokedextracker.entities.DexProgress;
import com.rodrigofranchini.pokedextracker.entities.DexProgressId;
import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.exceptions.UnknownDexException;
import com.rodrigofranchini.pokedextracker.repositories.DexProgressRepository;
import com.rodrigofranchini.pokedextracker.services.ProgressService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class ProgressServiceImpl implements ProgressService {

    // Without this, any string in the URL creates a row, so a client could fill
    // the table with dexes that do not exist. Adding a game is one entry.
    private static final Map<String, Set<String>> KNOWN_DEXES = Map.of(
            "scarlet-violet", Set.of("paldea", "kitakami", "blueberry"));

    private final DexProgressRepository dexProgressRepository;

    public ProgressServiceImpl(DexProgressRepository dexProgressRepository) {
        this.dexProgressRepository = dexProgressRepository;
    }

    @Transactional(readOnly = true)
    @Override
    public Optional<DexProgress> find(User user, String game, String dex) {
        requireKnownDex(game, dex);
        return dexProgressRepository.findById(new DexProgressId(user.getId(), game, dex));
    }

    @Transactional
    @Override
    public DexProgress replaceCaught(User user, String game, String dex, List<Integer> caught) {
        requireKnownDex(game, dex);
        int[] normalized = normalize(caught);

        // Upsert: the front end sends the whole list whether or not a row exists.
        DexProgress progress = dexProgressRepository.findById(new DexProgressId(user.getId(), game, dex))
                .orElseGet(() -> new DexProgress(user.getId(), game, dex, normalized));
        progress.replaceCaught(normalized);

        return dexProgressRepository.save(progress);
    }

    // Sorted and de-duplicated, so the stored value is canonical however the
    // client happened to build it.
    private int[] normalize(List<Integer> caught) {
        return caught.stream().mapToInt(Integer::intValue).distinct().sorted().toArray();
    }

    private void requireKnownDex(String game, String dex) {
        if (!KNOWN_DEXES.getOrDefault(game, Set.of()).contains(dex)) {
            throw new UnknownDexException("Unknown dex: " + game + "/" + dex);
        }
    }
}
