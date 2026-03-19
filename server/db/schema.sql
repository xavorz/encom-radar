-- Encom Radar - Schema de base de datos

CREATE TABLE IF NOT EXISTS oportunidades (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  organismo TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('licitación', 'subvención', 'fondo europeo')),
  importe TEXT,
  plazo_presentacion DATE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  justificacion_rating TEXT,
  por_que_encaja TEXT,
  fecha_deteccion DATE NOT NULL DEFAULT CURRENT_DATE,
  estado VARCHAR(30) NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'vista', 'guardada', 'en preparación', 'presentada', 'resuelta')),
  alerta_plazo BOOLEAN DEFAULT FALSE,
  url_fuente TEXT,
  nota_interna TEXT,
  informe JSONB,
  share_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS busquedas (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  resultados_encontrados INTEGER DEFAULT 0,
  resultados_guardados INTEGER DEFAULT 0,
  duracion_ms INTEGER,
  errores TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitas (
  id SERIAL PRIMARY KEY,
  ultima_visita TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar registro inicial de visita
INSERT INTO visitas (ultima_visita) VALUES (NOW()) ON CONFLICT DO NOTHING;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_oportunidades_fecha ON oportunidades(fecha_deteccion DESC);
CREATE INDEX IF NOT EXISTS idx_oportunidades_estado ON oportunidades(estado);
CREATE INDEX IF NOT EXISTS idx_oportunidades_rating ON oportunidades(rating DESC);
CREATE INDEX IF NOT EXISTS idx_oportunidades_share ON oportunidades(share_token);
CREATE INDEX IF NOT EXISTS idx_oportunidades_plazo ON oportunidades(plazo_presentacion);
