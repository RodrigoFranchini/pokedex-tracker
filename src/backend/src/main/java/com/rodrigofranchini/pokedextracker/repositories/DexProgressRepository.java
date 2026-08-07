package com.rodrigofranchini.pokedextracker.repositories;

import com.rodrigofranchini.pokedextracker.entities.DexProgress;
import com.rodrigofranchini.pokedextracker.entities.DexProgressId;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DexProgressRepository extends JpaRepository<DexProgress, DexProgressId> {
}
