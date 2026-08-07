package com.rodrigofranchini.pokedextracker.services;

import com.rodrigofranchini.pokedextracker.entities.DexProgress;
import com.rodrigofranchini.pokedextracker.entities.User;

import java.util.List;
import java.util.Optional;

public interface ProgressService {

    // Empty when the user has never saved this dex.
    Optional<DexProgress> find(User user, String game, String dex);

    DexProgress replaceCaught(User user, String game, String dex, List<Integer> caught);
}
