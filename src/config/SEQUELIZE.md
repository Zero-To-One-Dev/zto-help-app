# 📚 Guía de Sequelize - ZTO Help App

## 📁 Estructura

```
src/
├── migrate.js                    # CLI de migraciones
├── config/
│   ├── sequelize.js              # Instancia Sequelize (singleton)
│   ├── database.js               # Registro global de modelos
│   └── migrate.js                # Motor de migraciones por módulos
│
└── [modulo]/
    ├── models/
    │   ├── index.js              # Asociaciones + registro de modelos
    │   └── *.model.js            # Definición de modelos
    └── migrations/
        └── *.cjs                 # Archivos de migración
```

---

## 🚀 Inicio Rápido

### 1. Crear un nuevo modelo

```javascript
// src/mi-modulo/models/Producto.model.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/sequelize.js';

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'productos'  // Nombre de la tabla en BD
});

export default Producto;
```

### 2. Registrar modelos del módulo

```javascript
// src/mi-modulo/models/index.js
import sequelize from '../../config/sequelize.js';
import { registerModels } from '../../config/database.js';
import Producto from './Producto.model.js';
import Categoria from './Categoria.model.js';

// ============================================
// Asociaciones
// ============================================
Producto.belongsTo(Categoria, {
  foreignKey: 'categoria_id',
  as: 'categoria'
});

Categoria.hasMany(Producto, {
  foreignKey: 'categoria_id',
  as: 'productos'
});

// ============================================
// Registro global
// ============================================
const models = { Producto, Categoria };

registerModels('MiModulo', models);

export { sequelize, models };
export default models;
```

### 3. Crear una migración

```javascript
// src/mi-modulo/migrations/20260105000001-create-productos.cjs
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('productos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      nombre: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      precio: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('productos');
  }
};
```

### 4. Registrar módulo en el CLI

```javascript
// src/migrate.js
migrator.registerMigrationModule(
  'mi-modulo',
  path.resolve(__dirname, 'mi-modulo', 'migrations')
);
```

---

## 🛠️ Comandos de Migración

```bash
# Migrar todos los módulos
node src/migrate.js

# Migrar un módulo específico
node src/migrate.js --module cod-hub

# Ver estado de migraciones
node src/migrate.js --status
node src/migrate.js --status cod-hub

# Revertir última migración de un módulo
node src/migrate.js --rollback cod-hub

# Revertir N migraciones
node src/migrate.js --rollback cod-hub 3
```

---

## 📖 Uso de Modelos

### Importar modelos

```javascript
// Opción 1: Desde el módulo directamente
import { models } from '../cod-hub/models/index.js';
const { CodOrder, User } = models;

// Opción 2: Desde el registro global
import { getModel } from '../config/database.js';
const CodOrder = getModel('CodOrder');
const CodOrder = getModel('CodHub.CodOrder');  // Nombre completo (evita colisiones)
```

### Operaciones CRUD

```javascript
// CREAR
const orden = await CodOrder.create({
  store_id: 1,
  shopify_order_id: 123456789,
  order_name: '#1001',
  customer_name: 'Juan Pérez',
  address: 'Calle 123',
  city: 'Bogotá',
  country: 'CO'
});

// LEER - Uno
const orden = await CodOrder.findByPk(1);
const orden = await CodOrder.findOne({ 
  where: { shopify_order_id: 123456789 } 
});

// LEER - Varios
const ordenes = await CodOrder.findAll({
  where: { order_status: 'CONFIRMADA' },
  order: [['created_at', 'DESC']],
  limit: 10
});

// LEER - Con asociaciones
const orden = await CodOrder.findByPk(1, {
  include: [
    { model: User, as: 'confirmedByUser' },
    { model: CancelReason, as: 'cancelReason' }
  ]
});

// ACTUALIZAR
await CodOrder.update(
  { order_status: 'CONFIRMADA', confirmed_at: new Date() },
  { where: { id: 1 } }
);

// o con instancia
orden.order_status = 'CONFIRMADA';
await orden.save();

// ELIMINAR
await CodOrder.destroy({ where: { id: 1 } });

// o con instancia
await orden.destroy();
```

### Consultas avanzadas

```javascript
import { Op } from 'sequelize';

// Operadores
const ordenes = await CodOrder.findAll({
  where: {
    order_status: { [Op.in]: ['CONFIRMADA', 'ENTREGADA'] },
    created_at: { [Op.gte]: new Date('2026-01-01') },
    customer_name: { [Op.iLike]: '%pérez%' }
  }
});

// Contar
const total = await CodOrder.count({
  where: { order_status: 'CONFIRMADA' }
});

// Paginación
const { count, rows } = await CodOrder.findAndCountAll({
  where: { store_id: 1 },
  limit: 20,
  offset: 0,
  order: [['created_at', 'DESC']]
});

// Agrupar
const estadisticas = await CodOrder.findAll({
  attributes: [
    'order_status',
    [sequelize.fn('COUNT', sequelize.col('id')), 'total']
  ],
  group: ['order_status']
});
```

### Transacciones

```javascript
import sequelize from '../config/sequelize.js';

const t = await sequelize.transaction();

try {
  const orden = await CodOrder.create({
    // datos...
  }, { transaction: t });

  await HistorialOrden.create({
    orden_id: orden.id,
    // datos...
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

---

## 📊 Tipos de Datos Comunes

| Sequelize | PostgreSQL | Uso |
|-----------|------------|-----|
| `DataTypes.STRING(100)` | VARCHAR(100) | Texto corto |
| `DataTypes.TEXT` | TEXT | Texto largo |
| `DataTypes.INTEGER` | INTEGER | Enteros |
| `DataTypes.BIGINT` | BIGINT | Enteros grandes (IDs Shopify) |
| `DataTypes.DECIMAL(10,2)` | DECIMAL(10,2) | Precios |
| `DataTypes.BOOLEAN` | BOOLEAN | Verdadero/Falso |
| `DataTypes.DATE` | TIMESTAMP | Fecha y hora |
| `DataTypes.DATEONLY` | DATE | Solo fecha |
| `DataTypes.JSON` | JSON | Objetos JSON |
| `DataTypes.ENUM('A','B')` | ENUM | Valores fijos |
| `DataTypes.ARRAY(DataTypes.STRING)` | TEXT[] | Arrays |

---

## 🔗 Asociaciones

### Uno a Muchos (1:N)

```javascript
// Una Categoría tiene muchos Productos
Categoria.hasMany(Producto, {
  foreignKey: 'categoria_id',
  as: 'productos'
});

// Un Producto pertenece a una Categoría
Producto.belongsTo(Categoria, {
  foreignKey: 'categoria_id',
  as: 'categoria'
});
```

### Muchos a Muchos (N:M)

```javascript
// Tabla intermedia
const ProductoTag = sequelize.define('ProductoTag', {
  producto_id: DataTypes.INTEGER,
  tag_id: DataTypes.INTEGER
}, { tableName: 'producto_tags' });

Producto.belongsToMany(Tag, {
  through: ProductoTag,
  foreignKey: 'producto_id',
  as: 'tags'
});

Tag.belongsToMany(Producto, {
  through: ProductoTag,
  foreignKey: 'tag_id',
  as: 'productos'
});
```

---

## 🔐 Foreign Keys en Migraciones

```javascript
// En migración
categoria_id: {
  type: Sequelize.INTEGER,
  allowNull: true,
  references: {
    model: 'categorias',  // Nombre de la TABLA
    key: 'id'
  },
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL'
}
```

| Acción | Descripción |
|--------|-------------|
| `CASCADE` | Propaga el cambio/eliminación |
| `SET NULL` | Pone NULL (requiere `allowNull: true`) |
| `RESTRICT` | Impide la operación si hay referencias |
| `NO ACTION` | Similar a RESTRICT |

---

## 📝 Convenciones del Proyecto

1. **Nombres de archivos**: `NombreModelo.model.js`
2. **Nombres de tablas**: snake_case plural (`cod_orders`)
3. **Nombres de modelos**: PascalCase singular (`CodOrder`)
4. **Timestamps**: `created_at`, `updated_at` (automáticos)
5. **Foreign keys**: `nombre_tabla_id` (`store_id`, `user_id`)
6. **Migraciones**: `YYYYMMDDHHMMSS-descripcion.cjs`

---

## 🐛 Debugging

```javascript
// Habilitar logging SQL
const sequelize = new Sequelize(/* config */, {
  logging: console.log  // o logging: msg => logger.debug(msg)
});

// Ver SQL de una query sin ejecutar
const sql = CodOrder.findAll({
  where: { id: 1 }
}).toString();
```

---

## 📚 Referencias

- [Documentación oficial Sequelize v6](https://sequelize.org/docs/v6/)
- [Operadores](https://sequelize.org/docs/v6/core-concepts/model-querying-basics/#operators)
- [Migraciones](https://sequelize.org/docs/v6/other-topics/migrations/)
