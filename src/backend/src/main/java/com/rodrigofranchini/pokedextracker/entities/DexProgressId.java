package com.rodrigofranchini.pokedextracker.entities;

import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

// The composite primary key of dex_progress. Serializable because the JPA spec
// requires it of key classes -- one of the few places it is not cargo cult.
@Embeddable
public class DexProgressId implements Serializable {

    private UUID userId;
    private String game;
    private String dex;

    protected DexProgressId() {
        // Empty
    }

    public DexProgressId(UUID userId, String game, String dex) {
        this.userId = userId;
        this.game = game;
        this.dex = dex;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getGame() {
        return game;
    }

    public String getDex() {
        return dex;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof DexProgressId other)) return false;
        return userId.equals(other.userId) && game.equals(other.game) && dex.equals(other.dex);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, game, dex);
    }

    @Override
    public String toString() {
        return "DexProgressId{userId=" + userId + ", game=" + game + ", dex=" + dex + "}";
    }
}
