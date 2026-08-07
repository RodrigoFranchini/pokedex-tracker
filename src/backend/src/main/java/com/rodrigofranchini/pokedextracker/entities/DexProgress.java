package com.rodrigofranchini.pokedextracker.entities;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

// One row per (user, game, dex), holding the whole caught list. The list lives
// in a single column because sync replaces it wholesale -- see the README.
@Entity
@Table(name = "dex_progress")
public class DexProgress {

    @EmbeddedId
    private DexProgressId id;

    // National dex numbers, sparse. Absent means not caught, so correcting or
    // extending the dex data never invalidates stored progress.
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private int[] caught;

    @Column(nullable = false)
    private Instant updatedAt;

    protected DexProgress() {
        // Empty
    }

    public DexProgress(UUID userId, String game, String dex, int[] caught) {
        this.id = new DexProgressId(userId, game, dex);
        this.caught = caught;
        this.updatedAt = Instant.now();
    }

    // Last write wins on the whole list, which is what keeps sync simple.
    public void replaceCaught(int[] caught) {
        this.caught = caught;
        this.updatedAt = Instant.now();
    }

    public DexProgressId getId() {
        return id;
    }

    public int[] getCaught() {
        return caught;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof DexProgress other)) return false;
        return id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public String toString() {
        return "DexProgress{id=" + id + ", caught=" + caught.length + " entries}";
    }
}
