package com.rodrigofranchini.pokedextracker;

import org.springframework.boot.SpringApplication;

public class TestPokedexTrackerApplication {

	public static void main(String[] args) {
		SpringApplication.from(PokedexTrackerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
