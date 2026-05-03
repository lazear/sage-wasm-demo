use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use sage_core::{
    database::{Builder, EnzymeBuilder, IndexedDatabase},
    fasta::Fasta,
    ion_series::Kind,
    mass::Tolerance,
    scoring::{ScoreType, Scorer},
    spectrum::{Precursor, RawSpectrum, Representation, SpectrumProcessor},
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeakInput {
    mz: f32,
    intensity: f32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuerySpectrum {
    id: String,
    precursor_mz: f32,
    precursor_charge: u8,
    peaks: Vec<PeakInput>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryPayload {
    queries: Vec<QuerySpectrum>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct EngineOptions {
    enzyme: Option<EnzymeBuilder>,
    precursor_tolerance_lo_ppm: f32,
    precursor_tolerance_hi_ppm: f32,
    fragment_tolerance_lo_ppm: f32,
    fragment_tolerance_hi_ppm: f32,
    ion_kinds: Option<Vec<Kind>>,
    min_fragment_mz: f32,
    max_fragment_mz: f32,
    max_peaks: usize,
    min_peaks: usize,
    min_matched_peaks: u16,
    report_psms: usize,
    min_precursor_charge: u8,
    max_precursor_charge: u8,
    min_isotope_error: i8,
    max_isotope_error: i8,
    min_fragment_mass: f32,
    max_fragment_mass: f32,
    min_precursor_mass: f32,
    max_precursor_mass: f32,
    peptide_min_mass: Option<f32>,
    peptide_max_mass: Option<f32>,
    static_mods: Option<HashMap<String, f32>>,
    variable_mods: Option<HashMap<String, Vec<f32>>>,
    max_variable_mods: Option<usize>,
    decoy_tag: Option<String>,
    max_fragment_charge: Option<u8>,
    bucket_size: usize,
    min_ion_index: usize,
    generate_decoys: bool,
    min_deisotope_mz: f32,
    deisotope: Option<bool>,
}

impl Default for EngineOptions {
    fn default() -> Self {
        Self {
            enzyme: Some(EnzymeBuilder {
                missed_cleavages: Some(2),
                min_len: Some(7),
                max_len: Some(50),
                cleave_at: Some("KR".into()),
                restrict: Some("P".into()),
                c_terminal: Some(true),
                semi_enzymatic: Some(false),
            }),
            precursor_tolerance_lo_ppm: -10.0,
            precursor_tolerance_hi_ppm: 10.0,
            fragment_tolerance_lo_ppm: -20.0,
            fragment_tolerance_hi_ppm: 20.0,
            ion_kinds: Some(vec![Kind::B, Kind::Y]),
            min_fragment_mz: 150.0,
            max_fragment_mz: 2_000.0,
            max_peaks: 150,
            min_peaks: 1,
            min_matched_peaks: 1,
            report_psms: 5,
            min_precursor_charge: 2,
            max_precursor_charge: 4,
            min_isotope_error: 0,
            max_isotope_error: 0,
            min_fragment_mass: 150.0,
            max_fragment_mass: 2_000.0,
            min_precursor_mass: 0.0,
            max_precursor_mass: 10_000.0,
            peptide_min_mass: Some(500.0),
            peptide_max_mass: Some(5000.0),
            static_mods: Some(HashMap::from([("C".to_string(), 57.0215)])),
            variable_mods: Some(HashMap::from([("M".to_string(), vec![15.994])])),
            max_variable_mods: Some(3),
            decoy_tag: Some("rev_".into()),
            max_fragment_charge: None,
            bucket_size: 8192,
            min_ion_index: 2,
            generate_decoys: true,
            min_deisotope_mz: 0.0,
            deisotope: Some(true),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchedIon {
    kind: String,
    ordinal: i32,
    charge: i32,
    mz_calculated: f32,
    mz_experimental: f32,
    intensity: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HitResult {
    rank: u32,
    label: i32,
    peptide: String,
    proteins: String,
    score: f64,
    charge: u8,
    precursor_mz: f32,
    calculated_mass: f32,
    delta_mass: f32,
    matched_peaks: u32,
    matched_intensity_pct: f32,
    matched_ions: Vec<MatchedIon>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryResult {
    query_id: String,
    hits: Vec<HitResult>,
}

#[derive(Debug)]
struct InputSpectrum {
    id: String,
    precursor_mz: f32,
    precursor_charge: u8,
    mz: Vec<f32>,
    intensity: Vec<f32>,
}

impl From<QuerySpectrum> for InputSpectrum {
    fn from(query: QuerySpectrum) -> Self {
        let (mz, intensity) = query
            .peaks
            .into_iter()
            .map(|peak| (peak.mz, peak.intensity))
            .unzip();

        Self {
            id: query.id,
            precursor_mz: query.precursor_mz,
            precursor_charge: query.precursor_charge,
            mz,
            intensity,
        }
    }
}

impl InputSpectrum {
    fn to_raw_spectrum(self) -> RawSpectrum {
        RawSpectrum {
            file_id: 0,
            ms_level: 2,
            id: self.id,
            precursors: vec![Precursor {
                mz: self.precursor_mz,
                intensity: None,
                charge: Some(self.precursor_charge),
                spectrum_ref: None,
                isolation_window: None,
                inverse_ion_mobility: None,
            }],
            representation: Representation::Centroid,
            scan_start_time: 0.0,
            ion_injection_time: 0.0,
            total_ion_current: self.intensity.iter().sum(),
            mz: self.mz,
            intensity: self.intensity,
            mobility: None,
        }
    }
}

#[wasm_bindgen]
pub struct SearchEngine {
    db: IndexedDatabase,
    options: EngineOptions,
    processor: SpectrumProcessor,
}

#[wasm_bindgen]
impl SearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(fasta: &str, options_json: &str) -> Result<SearchEngine, JsValue> {
        let options: EngineOptions = if options_json.trim().is_empty() {
            EngineOptions::default()
        } else {
            serde_json::from_str(options_json).map_err(to_js_error)?
        };
        let decoy_tag = options.decoy_tag.clone().unwrap_or_else(|| "rev_".into());

        let fasta = Fasta::parse(fasta.to_string(), &decoy_tag, options.generate_decoys);

        let parameters = Builder {
            bucket_size: Some(options.bucket_size),
            enzyme: options.enzyme.clone(),
            peptide_min_mass: Some(options.peptide_min_mass.unwrap_or(options.min_precursor_mass)),
            peptide_max_mass: Some(options.peptide_max_mass.unwrap_or(options.max_precursor_mass)),
            ion_kinds: options.ion_kinds.clone(),
            min_ion_index: Some(options.min_ion_index),
            static_mods: options.static_mods.clone(),
            variable_mods: options.variable_mods.clone(),
            max_variable_mods: options.max_variable_mods,
            decoy_tag: Some(decoy_tag),
            generate_decoys: Some(options.generate_decoys),
            fasta: Some("embedded.fa".into()),
            prefilter_chunk_size: None,
            prefilter: Some(false),
            prefilter_low_memory: Some(true),
        };

        let parameters = parameters.make_parameters();
        let db = parameters.build(fasta);

        let processor = SpectrumProcessor::new(
            options.max_peaks,
            options.deisotope.unwrap_or(true),
            options.min_deisotope_mz,
        );

        Ok(SearchEngine {
            db,
            options,
            processor,
        })
    }

    #[wasm_bindgen]
    pub fn search_many(&self, queries_json: &str) -> Result<String, JsValue> {
        let payload: QueryPayload = serde_json::from_str(queries_json).map_err(to_js_error)?;
        let mut results: Vec<QueryResult> = Vec::with_capacity(payload.queries.len());

        for query in payload.queries {
            let spectrum = InputSpectrum::from(query);
            results.push(self.search_query(spectrum)?);
        }

        serde_json::to_string(&results).map_err(to_js_error)
    }

    #[wasm_bindgen]
    pub fn search_one(&self, query_json: &str) -> Result<String, JsValue> {
        let query: QuerySpectrum = serde_json::from_str(query_json).map_err(to_js_error)?;
        let payload = QueryPayload {
            queries: vec![query],
        };
        let output = self.search_many(&serde_json::to_string(&payload).map_err(to_js_error)?)?;
        Ok(output)
    }

    pub fn options_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.options).map_err(to_js_error)
    }
}

impl SearchEngine {
    fn build_scorer(&self) -> Scorer<'_> {
        Scorer {
            db: &self.db,
            precursor_tol: Tolerance::Ppm(
                self.options.precursor_tolerance_lo_ppm,
                self.options.precursor_tolerance_hi_ppm,
            ),
            fragment_tol: Tolerance::Ppm(
                self.options.fragment_tolerance_lo_ppm,
                self.options.fragment_tolerance_hi_ppm,
            ),
            min_matched_peaks: self.options.min_matched_peaks,
            min_isotope_err: self.options.min_isotope_error,
            max_isotope_err: self.options.max_isotope_error,
            min_precursor_charge: self.options.min_precursor_charge,
            max_precursor_charge: self.options.max_precursor_charge,
            override_precursor_charge: false,
            max_fragment_charge: self.options.max_fragment_charge,
            chimera: false,
            report_psms: self.options.report_psms,
            wide_window: false,
            annotate_matches: true,
            score_type: ScoreType::SageHyperScore,
        }
    }

    fn search_query(&self, input: InputSpectrum) -> Result<QueryResult, JsValue> {
        let query_id = input.id.clone();
        let mut query = self.processor.process(input.to_raw_spectrum());
        let mut hits = Vec::new();

        if query.peaks.len() < self.options.min_peaks {
            return Ok(QueryResult {
                query_id,
                hits,
            });
        }

        query.peaks.sort_by(|left, right| left.mass.total_cmp(&right.mass));

        let scorer = self.build_scorer();
        let mut features = scorer.score(&query);
        features.sort_unstable_by(|a, b| b.hyperscore.total_cmp(&a.hyperscore));

        let decoy_tag = self.options.decoy_tag.as_deref().unwrap_or("rev_");
        let generate_decoys = self.options.generate_decoys;

        for feat in features.into_iter().take(self.options.report_psms) {
            let peptide = &self.db[feat.peptide_idx];
            let proteins = peptide.proteins(decoy_tag, generate_decoys);
            let mut matched_ions = Vec::new();

            if let Some(fragments) = feat.fragments {
                let len = fragments
                    .kinds
                    .len()
                    .min(fragments.charges.len())
                    .min(fragments.fragment_ordinals.len())
                    .min(fragments.intensities.len())
                    .min(fragments.mz_calculated.len())
                    .min(fragments.mz_experimental.len());

                for idx in 0..len {
                    let kind = match fragments.kinds[idx] {
                        Kind::A => "a",
                        Kind::B => "b",
                        Kind::C => "c",
                        Kind::X => "x",
                        Kind::Y => "y",
                        Kind::Z => "z",
                    };

                    let mz_calculated = fragments.mz_calculated[idx];
                    let mz_experimental = fragments.mz_experimental[idx];
                    if !mz_calculated.is_finite() || !mz_experimental.is_finite() {
                        continue;
                    }

                    matched_ions.push(MatchedIon {
                        kind: kind.to_string(),
                        ordinal: fragments.fragment_ordinals[idx],
                        charge: fragments.charges[idx],
                        mz_calculated,
                        mz_experimental,
                        intensity: fragments.intensities[idx],
                    });
                }
            }

            hits.push(HitResult {
                rank: feat.rank,
                label: feat.label,
                peptide: peptide.to_string(),
                proteins,
                score: feat.hyperscore,
                charge: feat.charge,
                precursor_mz: feat.expmass,
                calculated_mass: feat.calcmass,
                delta_mass: feat.delta_mass,
                matched_peaks: feat.matched_peaks,
                matched_intensity_pct: feat.matched_intensity_pct,
                matched_ions,
            });
        }

        Ok(QueryResult {
            query_id,
            hits,
        })
    }
}

fn to_js_error<E: core::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&err.to_string())
}

// Keep `wasm_bindgen` happy if consumers import this crate directly in tests.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_default_roundtrip() {
        let options = EngineOptions::default();
        let json = serde_json::to_string(&options).unwrap();
        let parsed: EngineOptions = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.max_peaks, options.max_peaks);
    }
}
