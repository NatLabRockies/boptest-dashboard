import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import axios from 'axios';
import {
  createStyles,
  makeStyles,
  Theme,
  withStyles,
  useTheme,
} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import Menu from '@material-ui/core/Menu';
import SettingsIcon from '@material-ui/icons/Settings';
import PublicIcon from '@material-ui/icons/Public';
import LockIcon from '@material-ui/icons/Lock';

import {FilterMenu} from './FilterMenu';
import {useUser} from '../Context/user-context';
import {
  FilterRanges,
  FilterValues,
  ResultFacet,
  BuildingScenarios,
} from '../../../common/interfaces';
import {FilterChangePayload} from '../Lib/resultFilters';
import type {SelectProps} from '@material-ui/core/Select';
import {
  createRows,
  createTagOptions,
  createVersionOptions,
  Data,
  filterRows,
  getBuildingScenarios,
  getComparator,
  getFilterRanges,
  HeadCell,
  Order,
  setupFilters,
  stableSort,
} from '../Lib/TableHelpers';
import {ResultsScatterPlot, NumericColumnKey} from './ResultsScatterPlot';

const emptyFilterRanges: FilterRanges = {
  costRange: {min: 0, max: 0},
  thermalDiscomfortRange: {min: 0, max: 0},
  aqDiscomfortRange: {min: 0, max: 0},
  energyRange: {min: 0, max: 0},
};

const clampRange = (
  range: {min: number; max: number},
  limits: {min: number; max: number}
): {min: number; max: number} => {
  const clampedMin = Math.min(Math.max(range.min, limits.min), limits.max);
  const clampedMax = Math.min(Math.max(range.max, limits.min), limits.max);
  return {min: clampedMin, max: clampedMax};
};

const clampFiltersToRanges = (values: FilterValues, ranges: FilterRanges): FilterValues => {
  return {
    ...values,
    cost: clampRange(values.cost, ranges.costRange),
    thermalDiscomfort: clampRange(
      values.thermalDiscomfort,
      ranges.thermalDiscomfortRange
    ),
    aqDiscomfort: clampRange(values.aqDiscomfort, ranges.aqDiscomfortRange),
    energy: clampRange(values.energy, ranges.energyRange),
    scenario: {...values.scenario},
    tags: [...values.tags],
    boptestVersion: values.boptestVersion ?? '',
  };
};

const baseHeadCells: HeadCell[] = [
  {
    id: 'buildingTypeName',
    numeric: false,
    disablePadding: false,
    label: 'Test Case',
  },
  {id: 'dateRun', numeric: false, disablePadding: false, label: 'Date Run'},
  {
    id: 'totalEnergy',
    numeric: true,
    disablePadding: false,
    label: 'Total Energy [kWh/m^2]',
  },
  {
    id: 'thermalDiscomfort',
    numeric: true,
    disablePadding: false,
    label: 'Thermal Discomfort [Kh/zone]',
  },
  {
    id: 'aqDiscomfort',
    numeric: true,
    disablePadding: false,
    label: 'Indoor Air Quality Discomfort [ppmh/zone]',
  },
  {
    id: 'cost',
    numeric: true,
    disablePadding: false,
    label: 'Total Operations Cost [$ or Euro/m^2]',
  },
  {
    id: 'peakElectricity',
    numeric: true,
    disablePadding: false,
    label: 'Peak Electrical Demand [kW/m2]',
  },
  {
    id: 'peakGas',
    numeric: true,
    disablePadding: false,
    label: 'Peak Gas Demand [kW/m2]',
  },
  {
    id: 'peakDistrictHeating',
    numeric: true,
    disablePadding: false,
    label: 'Peak District Heating Demand [kW/m2]',
  },
  {
    id: 'compTimeRatio',
    numeric: true,
    disablePadding: false,
    label: 'Computational Time Ratio [-]',
  },
];

const columnWidths: Partial<Record<keyof Data, string>> = {
  buildingTypeName: '220px',
  dateRun: '200px',
  totalEnergy: '160px',
  thermalDiscomfort: '180px',
  aqDiscomfort: '220px',
  cost: '180px',
  peakElectricity: '200px',
  peakGas: '180px',
  peakDistrictHeating: '200px',
  compTimeRatio: '180px',
  isShared: '72px',
};

const numericColumnIds = [
  'totalEnergy',
  'thermalDiscomfort',
  'aqDiscomfort',
  'cost',
  'peakElectricity',
  'peakGas',
  'peakDistrictHeating',
  'compTimeRatio',
] as const;

const numericColumnOptions: Array<{id: NumericColumnKey; label: string}> = numericColumnIds.map(
  id => {
    const headCell = baseHeadCells.find(cell => cell.id === id);
    return {
      id,
      label: headCell ? headCell.label : id,
    };
  }
);

const fallbackAxisOption: {id: NumericColumnKey; label: string} =
  numericColumnOptions[0] ?? {
    id: 'totalEnergy',
    label:
      baseHeadCells.find(cell => cell.id === 'totalEnergy')?.label ||
      'Total Energy [kWh/m^2]',
  };

function buildHeadCells(includeShareColumn: boolean): HeadCell[] {
  if (!includeShareColumn) {
    return baseHeadCells;
  }
  return [
    ...baseHeadCells,
    {
      id: 'isShared',
      numeric: false,
      disablePadding: false,
      label: 'Shared',
    },
  ];
}

interface EnhancedTableProps {
  classes: ReturnType<typeof useStyles>;
  enableSelection: boolean;
  includeShareColumn: boolean;
  numSelected: number;
  onRequestSort: (
    event: React.MouseEvent<unknown>,
    property: keyof Data
  ) => void;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  order: Order;
  orderBy: keyof Data;
  rowCount: number;
}

const parseHeaderLabel = (label: string): {main: string; unit: string | null} => {
  const matches = label.match(/^(.*?)\s*(\[.*?\])?$/);
  if (matches && matches[2]) {
    return {
      main: matches[1].trim(),
      unit: matches[2].trim(),
    };
  }
  return {main: label, unit: null};
};

function EnhancedTableHead(props: EnhancedTableProps) {
  const {
    classes,
    enableSelection,
    includeShareColumn,
    numSelected,
    onSelectAllClick,
    onRequestSort,
    order,
    orderBy,
    rowCount,
  } = props;
  const theme = useTheme();
  const headCells = buildHeadCells(includeShareColumn);

  const createSortHandler =
    (property: keyof Data) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  const allSelected = rowCount > 0 && numSelected === rowCount;

  return (
    <TableHead style={{borderSpacing: '0 !important'}}>
      <TableRow style={{borderCollapse: 'collapse'}}>
        {enableSelection && (
          <TableCell
            padding="checkbox"
            style={{width: '52px'}}
            className={`${classes.headerCell} ${classes.stickyHeader}`}
          >
            <div className={classes.checkboxWrapper}>
              <Checkbox
                checked={allSelected}
                indeterminate={numSelected > 0 && numSelected < rowCount}
                onChange={onSelectAllClick}
                inputProps={{'aria-label': 'select all results'}}
                color="primary"
              />
            </div>
          </TableCell>
        )}
        {headCells.map(headCell => {
          const {main, unit} = parseHeaderLabel(headCell.label);
          const width = columnWidths[headCell.id];

          return (
            <TableCell
              key={headCell.id}
              align={'center'}
              padding={'none'}
              sortDirection={orderBy === headCell.id ? order : false}
              className={`${classes.headerCell} ${classes.stickyHeader}`}
              style={width ? {width} : undefined}
            >
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
              >
                <div>
                  <span className={classes.headerLabel}>{main}</span>
                  {unit && <span className={classes.headerUnit}>{unit}</span>}
                </div>
                {orderBy === headCell.id ? (
                  <span className={classes.visuallyHidden}>
                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                  </span>
                ) : null}
              </TableSortLabel>
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
}

const useToolbarStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 3, 1, 3),
      borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      minHeight: '56px',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
    filterContainer: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      flex: 1,
      minWidth: 0,
    },
    filterActions: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
    },
    select: {
      margin: theme.spacing(0, 2, 0, 0),
      width: '320px',
      maxWidth: '100%',
    },
    selectIcon: {
      fill: theme.palette.primary.main,
    },
    toggleContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minWidth: '220px',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
    },
    summary: {
      color: theme.palette.text.secondary,
    },
    actionButton: {
      marginLeft: theme.spacing(1),
    },
  })
);

const ColorButton = withStyles(theme => ({
  root: {
    color: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    margin: theme.spacing(0, 0, 0, 1.5),
    height: '40px',
    padding: theme.spacing(0, 2),
    fontWeight: 600,
  },
}))(Button);

const ColorSelect = withStyles(theme => ({
  root: {
    '& label': {
      color: theme.palette.primary.main,
    },
    '& label.Mui-focused': {
      color: theme.palette.primary.main,
    },
    '& .MuiInput-underline:after': {
      borderBottomColor: theme.palette.primary.main,
    },
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: theme.palette.primary.main,
      },
      '&:hover fieldset': {
        borderColor: theme.palette.primary.main,
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
      },
    },
    '& .MuiSelect-icon': {
      right: '12px',
      position: 'absolute',
    },
    '& .MuiSelect-select': {
      paddingRight: '60px !important',
    },
  },
}))(TextField);

interface ToolbarActionItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface EnhancedTableToolbarProps {
  buildingTypeFilterOptions: string[];
  displayClear: boolean;
  buildingFilterValue: string;
  updateBuildingFilter: (value: string) => void;
  onClearFilters: () => void;
  enableSelection?: boolean;
  actions?: ToolbarActionItem[];
  actionsDisabled?: boolean;
  summaryText: string;
  summaryAction?: React.ReactNode;
}

const EnhancedTableToolbar = (props: EnhancedTableToolbarProps) => {
  const classes = useToolbarStyles();
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const {
    buildingTypeFilterOptions,
    displayClear,
    buildingFilterValue,
    updateBuildingFilter,
    onClearFilters,
    enableSelection = false,
    actions,
    actionsDisabled = false,
    summaryText,
    summaryAction,
  } = props;

  const hasActions = Boolean(actions && actions.length > 0);
  const allActionsDisabled =
    !actions || actions.length === 0 || actions.every(action => action.disabled);

  useEffect(() => {
    if ((actionsDisabled || allActionsDisabled) && actionAnchorEl) {
      setActionAnchorEl(null);
    }
  }, [actionsDisabled, allActionsDisabled, actionAnchorEl]);

  const baseSelectProps: Partial<SelectProps> = {
    classes: {icon: classes.selectIcon},
    MenuProps: {
      anchorOrigin: {
        vertical: 'bottom' as const,
        horizontal: 'left' as const,
      },
      getContentAnchorEl: null,
    },
    displayEmpty: true,
  };

  const handleSelectChange = (
    event: React.ChangeEvent<{name?: string; value: unknown}>
  ) => {
    const value = event.target.value as string;
    updateBuildingFilter(value === 'all' ? '' : value);
  };

  return (
    <Toolbar className={classes.root}>
      <div className={classes.filterContainer}>
        <ColorSelect
          className={classes.select}
          label=""
          placeholder="Building Type"
          name="buildingType-filter"
          onChange={handleSelectChange}
          select
          value={buildingFilterValue || 'all'}
          defaultValue="all"
          variant="outlined"
          SelectProps={{
            ...baseSelectProps,
            renderValue: value =>
              value && value !== 'all' ? (value as string) : 'All Test Cases',
          }}
          size="small"
          InputProps={{
            style: {
              height: '40px',
            },
          }}
        >
          <MenuItem value="all">All Test Cases</MenuItem>
          {buildingTypeFilterOptions
            .filter(option => option !== 'All Test Cases')
            .map(option => (
              <MenuItem key={`${option}-option`} value={option}>
                {option}
              </MenuItem>
            ))}
        </ColorSelect>
        <div className={classes.filterActions}>
          {displayClear && (
            <ColorButton variant="outlined" onClick={onClearFilters}>
              Clear
            </ColorButton>
          )}
        </div>
      </div>

      <div className={classes.toggleContainer}>
        <Typography variant="body2" className={classes.summary}>
          {summaryText}
        </Typography>
        {summaryAction}
        {hasActions && (
          <>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<SettingsIcon fontSize="small" />}
              onClick={event => setActionAnchorEl(event.currentTarget)}
              disabled={actionsDisabled || allActionsDisabled}
              className={classes.actionButton}
            >
              Actions
            </Button>
            <Menu
              anchorEl={actionAnchorEl}
              open={Boolean(actionAnchorEl)}
              onClose={() => setActionAnchorEl(null)}
              keepMounted
            >
              {(actions || []).map((action, index) => (
                <MenuItem
                  key={`toolbar-action-${index}`}
                  onClick={() => {
                    setActionAnchorEl(null);
                    action.onClick();
                  }}
                  disabled={actionsDisabled || action.disabled}
                >
                  {action.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </div>
    </Toolbar>
  );
};

const useFilterToolbarStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      justifyContent: 'space-between',
      padding: theme.spacing(1, 3, 0, 3),
      marginTop: theme.spacing(1),
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    },
  })
);

interface FilterToolbarProps {
  scenarioOptions?: Record<string, string[]>;
  tagOptions: string[];
  versionOptions: string[];
  filterRanges: FilterRanges;
  filterValues: FilterValues;
  updateFilters: (requestedFilters: FilterValues) => void;
}

const FilterToolbar = (props: FilterToolbarProps) => {
  const classes = useFilterToolbarStyles();
  const {
    filterRanges,
    filterValues,
    scenarioOptions,
    tagOptions,
    versionOptions,
    updateFilters,
  } = props;

  const onRequestUpdateFilters = (requestedFilters: FilterValues) => {
    updateFilters(requestedFilters);
  };

  return (
    <Toolbar className={classes.root}>
      <FilterMenu
        filterRanges={filterRanges}
        filterValues={filterValues}
        onRequestFilters={onRequestUpdateFilters}
        scenarioOptions={scenarioOptions}
        tagOptions={tagOptions}
        versionOptions={versionOptions}
      />
    </Toolbar>
  );
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      minHeight: 0,
    },
    paper: {
      width: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      minHeight: 0,
    },
    headerCell: {
      fontWeight: 600,
      padding: theme.spacing(1.5),
      minWidth: 0,
      border: 'none',
      borderBottom: '1px solid rgba(224, 224, 224, 1)',
    },
    headerLabel: {
      display: 'block',
      fontWeight: 600,
      fontSize: '0.875rem',
      lineHeight: 1.2,
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    headerUnit: {
      display: 'block',
      fontSize: '0.75rem',
      fontWeight: 400,
      color: 'rgba(0, 0, 0, 0.6)',
      marginTop: theme.spacing(0.5),
      whiteSpace: 'nowrap',
    },
    checkboxWrapper: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    },
    table: {
      minWidth: 750,
      width: '100%',
      tableLayout: 'fixed',
      '& .MuiTableCell-root': {
        borderLeft: 'none',
        borderRight: 'none',
      },
    },
    tableContainer: {
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      overflowX: 'auto',
      maxHeight: 'none',
      minHeight: 0,
    },
    stickyHeader: {
      position: 'sticky',
      top: 0,
      backgroundColor: '#fff',
      zIndex: 10,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderRight: 'none',
      '&::after': {
        content: '""',
        position: 'absolute',
        left: 0,
        right: 0,
        height: '1px',
        bottom: 0,
        backgroundColor: 'rgba(224, 224, 224, 1)',
      },
    },
    visuallyHidden: {
      border: 0,
      clip: 'rect(0 0 0 0)',
      height: 1,
      margin: -1,
      overflow: 'hidden',
      padding: 0,
      position: 'absolute',
      top: 20,
      width: 1,
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
      padding: theme.spacing(3),
      borderTop: '1px solid rgba(0, 0, 0, 0.08)',
      marginTop: 'auto',
    },
    footerText: {
      flexGrow: 1,
      textAlign: 'center',
    },
    footerToggle: {
      marginLeft: 'auto',
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      fontWeight: 500,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    shareStatusWrapper: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.spacing(5),
    },
    tableRow: {
      '&$selected, &$selected:hover': {
        backgroundColor: theme.palette.primary.light,
      },
    },
    selected: {},
    loadMoreRow: {
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
    loadMoreContainer: {
      display: 'flex',
      justifyContent: 'center',
      padding: theme.spacing(2, 0),
      width: '100%',
      overflow: 'hidden',
      position: 'sticky',
      left: 0,
      right: 0,
      backgroundColor: theme.palette.background.paper,
      zIndex: 1,
      maxWidth: '100vw',
      margin: '0 auto',
    },
    loadMoreInner: {
      position: 'relative',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
    },
    loadMoreGradientLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: theme.spacing(12),
      background: `linear-gradient(to right, ${theme.palette.background.paper} 0%, rgba(255,255,255,0) 100%)`,
      pointerEvents: 'none',
    },
    loadMoreGradientRight: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: theme.spacing(12),
      background: `linear-gradient(to left, ${theme.palette.background.paper} 0%, rgba(255,255,255,0) 100%)`,
      pointerEvents: 'none',
    },
    scatterControls: {
      display: 'flex',
      gap: theme.spacing(2),
      padding: theme.spacing(1, 3, 0, 3),
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: 56,
    },
    axisSelect: {
      marginRight: theme.spacing(2),
      '& .MuiInputBase-root': {
        height: '40px',
      },
      '&:last-child': {
        marginRight: 0,
      },
    },
    scatterWrapper: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 3, 0, 3),
      minHeight: 0,
    },
  })
);

interface ResultsTableProps {
  results: any[];
  buildingFacets: ResultFacet[];
  setSelectedResult: (result: any) => void;
  enableSelection?: boolean;
  enableShareToggle?: boolean;
  onShareToggleComplete?: () => void;
  showDownloadButton?: boolean;
  isLoading?: boolean;
  onFiltersChange?: (payload: FilterChangePayload) => void;
  hasMoreResults?: boolean;
  onLoadMoreResults?: () => void;
  isLoadingMoreResults?: boolean;
  onResetFilters?: () => void;
  resetOnResultsChange?: boolean;
  initialFilters?: FilterValues;
  initialFilterRanges?: FilterRanges;
}

export default function ResultsTable(props: ResultsTableProps) {
  const {
    results,
    buildingFacets = [],
    setSelectedResult,
    enableSelection = false,
    enableShareToggle = false,
    onShareToggleComplete,
    showDownloadButton = false,
    isLoading = false,
    onFiltersChange,
    hasMoreResults = false,
    onLoadMoreResults,
    isLoadingMoreResults = false,
    onResetFilters,
    resetOnResultsChange = false,
    initialFilters,
    initialFilterRanges,
  } = props;

  const {csrfToken} = useUser();
  const sessionHeaders = useMemo(
    () => (csrfToken ? {'X-CSRF-Token': csrfToken} : {}),
    [csrfToken]
  );

  const classes = useStyles();
  const toolbarClasses = useToolbarStyles();
  const getColumnWidth = (column: keyof Data) => columnWidths[column];
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<keyof Data>('dateRun');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [displayFilters, setDisplayFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'scatter'>('table');
  const [xAxisId, setXAxisId] = useState<NumericColumnKey>(
    numericColumnOptions[0]?.id ?? 'totalEnergy'
  );
  const [yAxisId, setYAxisId] = useState<NumericColumnKey>(
    numericColumnOptions[1]?.id ?? numericColumnOptions[0]?.id ?? 'thermalDiscomfort'
  );
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>('');
  const [scenarioOptions, setScenarioOptions] = useState<Record<string, string[]>>({});
  const filtersInitialized = useRef(false);
  const [areFiltersReady, setAreFiltersReady] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(() =>
    setupFilters(emptyFilterRanges, [])
  );
  const [filterRanges, setFilterRanges] = useState<FilterRanges>(emptyFilterRanges);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);

  const normalizeFilters = useCallback(
    (value: FilterValues): FilterValues => ({
      ...value,
      boptestVersion: value.boptestVersion ?? '',
    }),
    []
  );

  const formatMetric = (
    value: number | null | undefined,
    fractionDigits = 4
  ): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'N/A';
    }
    return value.toFixed(fractionDigits);
  };

  const rows = useMemo(() => createRows(results), [results]);
  const buildingScenarios = useMemo(() => getBuildingScenarios(buildingFacets), [buildingFacets]);
  const computedFilterRanges = useMemo(() => getFilterRanges(rows), [rows]);
  const filteredRows = useMemo(() => {
    if (onFiltersChange || !areFiltersReady) {
      return rows;
    }
    return filterRows(rows, buildingTypeFilter, filters);
  }, [onFiltersChange, rows, buildingTypeFilter, filters, areFiltersReady]);

  useEffect(() => {
    if (!resetOnResultsChange) {
      return;
    }
    filtersInitialized.current = false;
    setAreFiltersReady(false);
  }, [resetOnResultsChange, results]);

  useEffect(() => {
    if (onFiltersChange) {
      return;
    }
    if (!initialFilters) {
      return;
    }
    setFilters(normalizeFilters(initialFilters));
    if (initialFilterRanges) {
      setFilterRanges(initialFilterRanges);
    }
    filtersInitialized.current = true;
    setAreFiltersReady(true);
  }, [initialFilters, initialFilterRanges, onFiltersChange, normalizeFilters]);
  const xAxisOption = useMemo(() => {
    return numericColumnOptions.find(option => option.id === xAxisId) ?? fallbackAxisOption;
  }, [xAxisId]);
  const yAxisOption = useMemo(() => {
    return numericColumnOptions.find(option => option.id === yAxisId) ?? fallbackAxisOption;
  }, [yAxisId]);
  const fallbackTagOptions = useMemo(() => createTagOptions(filteredRows), [filteredRows]);
  const tagOptions = useMemo(() => {
    if (!onFiltersChange) {
      return fallbackTagOptions;
    }

    if (buildingTypeFilter) {
      const facet = buildingFacets.find(
        item => item.buildingTypeName === buildingTypeFilter
      );
      if (facet?.tags?.length) {
        const store = new Map<string, string>();
        facet.tags.forEach((tag: string) => {
          if (typeof tag !== 'string') {
            return;
          }
          const normalized = tag.trim();
          if (!normalized) {
            return;
          }
          const key = normalized.toLowerCase();
          if (!store.has(key)) {
            store.set(key, normalized);
          }
        });
        return Array.from(store.values()).sort((a, b) =>
          a.localeCompare(b, undefined, {sensitivity: 'base'})
        );
      }
      return [];
    }

    const store = new Map<string, string>();
    buildingFacets.forEach(facet => {
      (facet.tags || []).forEach((tag: string) => {
        if (typeof tag !== 'string') {
          return;
        }
        const normalized = tag.trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        if (!store.has(key)) {
          store.set(key, normalized);
        }
      });
    });
    return Array.from(store.values()).sort((a, b) =>
      a.localeCompare(b, undefined, {sensitivity: 'base'})
    );
  }, [onFiltersChange, fallbackTagOptions, buildingFacets, buildingTypeFilter]);

  const versionOptions = useMemo(() => {
    const sourceRows = filteredRows.length > 0 ? filteredRows : rows;
    return createVersionOptions(sourceRows);
  }, [filteredRows, rows]);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }

    const expandRange = (
      current: {min: number; max: number},
      active: {min: number; max: number}
    ) => ({
      min: Math.min(current.min, active.min),
      max: Math.max(current.max, active.max),
    });

    const expandedRanges: FilterRanges = {
      costRange: expandRange(computedFilterRanges.costRange, filters.cost),
      thermalDiscomfortRange: expandRange(
        computedFilterRanges.thermalDiscomfortRange,
        filters.thermalDiscomfort
      ),
      aqDiscomfortRange: expandRange(
        computedFilterRanges.aqDiscomfortRange,
        filters.aqDiscomfort
      ),
      energyRange: expandRange(
        computedFilterRanges.energyRange,
        filters.energy
      ),
    };

    setFilterRanges(expandedRanges);
    const nextScenarioOptions: Record<string, string[]> = {};

    if (!onFiltersChange) {
      if (!filtersInitialized.current && rows.length > 0) {
        const scenarioKeys = buildingTypeFilter
          ? Object.keys(buildingScenarios[buildingTypeFilter] || {})
          : [];
        setFilters(
          normalizeFilters(
            setupFilters(computedFilterRanges, scenarioKeys)
          )
        );
        filtersInitialized.current = true;
        setAreFiltersReady(true);
      }
    } else {
      const addScenarioValue = (bucket: Map<string, string>, rawValue: unknown) => {
        if (rawValue === undefined || rawValue === null) {
          return;
        }
        const normalized = String(rawValue).trim();
        if (!normalized) {
          return;
        }
        const key = normalized.toLowerCase();
        if (!bucket.has(key)) {
          bucket.set(key, normalized);
        }
      };

      if (buildingTypeFilter) {
        const facet = buildingFacets.find(
          item => item.buildingTypeName === buildingTypeFilter
        );
        if (facet && facet.scenario) {
          Object.entries(facet.scenario as Record<string, unknown[] | undefined>).forEach(([key, values]) => {
            const bucket = new Map<string, string>();
            (values || []).forEach(value => addScenarioValue(bucket, value));
            nextScenarioOptions[key] = Array.from(bucket.values()).sort((a, b) =>
              a.localeCompare(b, undefined, {sensitivity: 'base'})
            );
          });
        }
      } else {
        const scenarioBuckets: Record<string, Map<string, string>> = {};
        buildingFacets.forEach(facet => {
          Object.entries((facet.scenario || {}) as Record<string, unknown[] | undefined>).forEach(([key, values]) => {
            if (!scenarioBuckets[key]) {
              scenarioBuckets[key] = new Map<string, string>();
            }
            (values || []).forEach(value => addScenarioValue(scenarioBuckets[key], value));
          });
        });
        Object.entries(scenarioBuckets).forEach(([key, bucket]) => {
          nextScenarioOptions[key] = Array.from(bucket.values()).sort((a, b) =>
            a.localeCompare(b, undefined, {sensitivity: 'base'})
          );
        });
      }
    }

    setScenarioOptions(nextScenarioOptions);
  }, [
    computedFilterRanges,
    rows.length,
    buildingTypeFilter,
    buildingScenarios,
    buildingFacets,
    onFiltersChange,
    filters,
    normalizeFilters,
  ]);

  useEffect(() => {
    setFilters((prev: FilterValues) => {
      const clamped = clampFiltersToRanges(prev, filterRanges);
      const rangesMatch =
        prev.cost.min === clamped.cost.min &&
        prev.cost.max === clamped.cost.max &&
        prev.energy.min === clamped.energy.min &&
        prev.energy.max === clamped.energy.max &&
        prev.thermalDiscomfort.min === clamped.thermalDiscomfort.min &&
        prev.thermalDiscomfort.max === clamped.thermalDiscomfort.max &&
        prev.aqDiscomfort.min === clamped.aqDiscomfort.min &&
        prev.aqDiscomfort.max === clamped.aqDiscomfort.max;
      if (rangesMatch) {
        return prev;
      }
      return clamped;
    });
  }, [filterRanges]);

  useEffect(() => {
    setSelectedIds(prev =>
      prev.filter(id => filteredRows.some(row => row.id === id))
    );
  }, [filteredRows]);

  const handleUpdateFilters = (requestedFilters: FilterValues) => {
    const normalized = normalizeFilters(requestedFilters);
    setFilters(normalized);
    filtersInitialized.current = true;
    setAreFiltersReady(true);
    onFiltersChange?.({
      buildingTypeName: buildingTypeFilter,
      filters: normalized,
      includeAdvancedFilters: true,
    });
  };

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextView: 'table' | 'scatter' | null
  ) => {
    if (!nextView) {
      return;
    }
    setViewMode(nextView);
  };

  const handleXAxisChange = (
    event: React.ChangeEvent<{name?: string; value: unknown}>
  ) => {
    setXAxisId(event.target.value as NumericColumnKey);
  };

  const handleYAxisChange = (
    event: React.ChangeEvent<{name?: string; value: unknown}>
  ) => {
    setYAxisId(event.target.value as NumericColumnKey);
  };

  const handleClearFilters = () => {
    setBuildingTypeFilter('');
    setDisplayFilters(false);
    const nextFilters = normalizeFilters(
      setupFilters(computedFilterRanges, [])
    );
    setFilters(nextFilters);
    setFilterRanges(computedFilterRanges);
    filtersInitialized.current = true;
    setAreFiltersReady(true);
    onResetFilters?.();
  };

  const handleUpdateBuildingFilter = (requestedBuilding: string) => {
    if (requestedBuilding === '') {
      handleClearFilters();
      return;
    }

    setBuildingTypeFilter(requestedBuilding);
    const scenarioKeys = Object.keys(buildingScenarios[requestedBuilding] || {});
    setDisplayFilters(true);
    const nextFilters = normalizeFilters(
      setupFilters(
        computedFilterRanges,
        requestedBuilding === '' ? [] : scenarioKeys
      )
    );
    setFilters(nextFilters);
    if (requestedBuilding === '') {
      setFilterRanges(computedFilterRanges);
    } else {
      const expandRange = (
        current: {min: number; max: number},
        active: {min: number; max: number}
      ) => ({
        min: Math.min(current.min, active.min),
        max: Math.max(current.max, active.max),
      });

      setFilterRanges({
        costRange: expandRange(computedFilterRanges.costRange, nextFilters.cost),
        thermalDiscomfortRange: expandRange(
          computedFilterRanges.thermalDiscomfortRange,
          nextFilters.thermalDiscomfort
        ),
        aqDiscomfortRange: expandRange(
          computedFilterRanges.aqDiscomfortRange,
          nextFilters.aqDiscomfort
        ),
        energyRange: expandRange(
          computedFilterRanges.energyRange,
          nextFilters.energy
        ),
      });
    }
    filtersInitialized.current = true;
    setAreFiltersReady(true);
    onFiltersChange?.({
      buildingTypeName: requestedBuilding,
      filters: nextFilters,
      includeAdvancedFilters: false,
    });
  };

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof Data
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!enableSelection) {
      return;
    }
    if (event.target.checked) {
      const newSelecteds = filteredRows.map(row => row.id);
      setSelectedIds(newSelecteds);
      return;
    }
    setSelectedIds([]);
  };

  const handleCheckboxClick = (
    event: React.MouseEvent<unknown>,
    id: number
  ) => {
    event.stopPropagation();
    if (!enableSelection) {
      return;
    }

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(existing => existing !== id);
      }
      return [...prev, id];
    });
  };

  const isSelected = (id: number) => selectedIds.indexOf(id) !== -1;

  const handleRowClick = (
    event: React.MouseEvent<unknown>,
    result: Data
  ) => {
    event.preventDefault();
    setSelectedResult(result);
  };

  const selectedRows = useMemo(
    () => filteredRows.filter(row => selectedIds.includes(row.id)),
    [filteredRows, selectedIds]
  );

  const updateShareForSelection = useCallback(
    async (share: boolean) => {
      if (!enableShareToggle) {
        return;
      }

      const targets = selectedRows.filter(row => row.isShared !== share);
      if (targets.length === 0) {
        return;
      }

      setIsUpdatingShare(true);
      try {
        const responses = await Promise.allSettled(
          targets.map(target =>
            axios.patch(
              '/api/results/share',
              {id: target.id, share},
              {
                headers: sessionHeaders,
                withCredentials: true,
              }
            )
          )
        );

        const rejected = responses.filter(
          result => result.status === 'rejected'
        );
        if (rejected.length > 0) {
          rejected.forEach(result => {
            if (result.status === 'rejected') {
              console.error('Unable to update sharing preference', result.reason);
            }
          });
        }
        onShareToggleComplete?.();
      } catch (error) {
        console.error('Unable to update sharing preference', error);
      } finally {
        setIsUpdatingShare(false);
      }
    },
    [enableShareToggle, onShareToggleComplete, selectedRows, sessionHeaders]
  );

  const handleShareSelected = useCallback(() => {
    updateShareForSelection(true);
  }, [updateShareForSelection]);

  const handleMakePrivateSelected = useCallback(() => {
    updateShareForSelection(false);
  }, [updateShareForSelection]);

  const downloadResultsToCSV = () => {
    if (!enableSelection || selectedRows.length === 0) {
      return;
    }

    const headers = [
      'Result UID',
      'Building Type',
      'Date Run',
      'Total Energy',
      'Thermal Discomfort',
      'IAQ Discomfort',
      'Cost',
      'Peak Electricity',
      'Peak Gas',
      'Peak District Heating',
      'Computational Time Ratio',
      'Shared',
    ];

    const csvRows = selectedRows.map(row => [
      row.uid,
      row.buildingTypeName,
      new Date(row.dateRun).toISOString(),
      row.totalEnergy,
      row.thermalDiscomfort,
      row.aqDiscomfort,
      row.cost,
      row.peakElectricity,
      row.peakGas ?? '',
      row.peakDistrictHeating ?? '',
      row.compTimeRatio,
      row.isShared ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tableRows: Data[] = stableSort(filteredRows, getComparator(order, orderBy));
  const includeShareColumn = enableShareToggle;
  const headCells = buildHeadCells(includeShareColumn);
  const columnCount = headCells.length + (enableSelection ? 1 : 0);
  const displayClear = buildingTypeFilter !== '';
  const selectionSummary =
    enableSelection && viewMode === 'table' && selectedIds.length > 0
      ? `${selectedIds.length.toLocaleString()} selected`
      : null;
  const resultCountLabel = filteredRows.length.toLocaleString();
  const defaultSummary = hasMoreResults
    ? `Newest ${resultCountLabel} results`
    : `All ${resultCountLabel} results`;
  const summaryTextValue = selectionSummary ?? defaultSummary;
  const summaryAction =
    viewMode === 'scatter' && hasMoreResults && onLoadMoreResults ? (
      <Button
        variant="outlined"
        color="primary"
        size="small"
        onClick={onLoadMoreResults}
        disabled={isLoadingMoreResults}
      >
        {isLoadingMoreResults ? 'Loading...' : 'Load more results'}
      </Button>
    ) : undefined;

  const toolbarActions = useMemo<ToolbarActionItem[] | undefined>(() => {
    const selectionEnabled = enableSelection && viewMode === 'table';
    if (!selectionEnabled) {
      return undefined;
    }

    const actions: ToolbarActionItem[] = [];
    const selectedCount = selectedRows.length;
    const allSelectedShared =
      selectedCount > 0 && selectedRows.every(row => row.isShared);
    const allSelectedPrivate =
      selectedCount > 0 && selectedRows.every(row => !row.isShared);

    if (enableShareToggle) {
      actions.push(
        {
          label: 'Share selected',
          onClick: handleShareSelected,
          disabled:
            isUpdatingShare || selectedCount === 0 || allSelectedShared,
        },
        {
          label: 'Make selected private',
          onClick: handleMakePrivateSelected,
          disabled:
            isUpdatingShare || selectedCount === 0 || allSelectedPrivate,
        }
      );
    }

    if (showDownloadButton) {
      actions.push({
        label: 'Download selected',
        onClick: downloadResultsToCSV,
        disabled: selectedCount === 0,
      });
    }

    return actions.length > 0 ? actions : undefined;
  }, [
    downloadResultsToCSV,
    enableSelection,
    enableShareToggle,
    handleMakePrivateSelected,
    handleShareSelected,
    isUpdatingShare,
    selectedRows,
    showDownloadButton,
    viewMode,
  ]);

  return (
    <div className={classes.root}>
      <Paper className={classes.paper}>
        <EnhancedTableToolbar
          buildingTypeFilterOptions={
            buildingScenarios && Object.keys(buildingScenarios)
          }
          displayClear={displayClear}
          buildingFilterValue={buildingTypeFilter}
          updateBuildingFilter={handleUpdateBuildingFilter}
          onClearFilters={handleClearFilters}
          enableSelection={enableSelection && viewMode === 'table'}
          actions={toolbarActions}
          summaryText={summaryTextValue}
          summaryAction={summaryAction}
        />
        {displayFilters && (
          <FilterToolbar
            scenarioOptions={
              onFiltersChange
                ? (Object.keys(scenarioOptions).length > 0 ? scenarioOptions : undefined)
                : buildingTypeFilter
                    ? (buildingScenarios[buildingTypeFilter] as Record<string, string[]>)
                    : undefined
            }
            tagOptions={tagOptions}
            versionOptions={versionOptions}
            filterRanges={filterRanges}
            filterValues={filters}
            updateFilters={handleUpdateFilters}
          />
        )}
        {viewMode === 'scatter' && (
          <Toolbar className={classes.scatterControls}>
            <ColorSelect
              className={`${toolbarClasses.select} ${classes.axisSelect}`}
              label="X Axis"
              select
              value={xAxisId}
              onChange={handleXAxisChange}
              variant="outlined"
              size="small"
              InputLabelProps={{shrink: true}}
            >
              {numericColumnOptions.map(option => (
                <MenuItem key={`x-axis-${option.id}`} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </ColorSelect>
            <ColorSelect
              className={`${toolbarClasses.select} ${classes.axisSelect}`}
              label="Y Axis"
              select
              value={yAxisId}
              onChange={handleYAxisChange}
              variant="outlined"
              size="small"
              InputLabelProps={{shrink: true}}
            >
              {numericColumnOptions.map(option => (
                <MenuItem key={`y-axis-${option.id}`} value={option.id}>
                  {option.label}
                </MenuItem>
              ))}
            </ColorSelect>
          </Toolbar>
        )}
        {viewMode === 'table' ? (
          <TableContainer className={classes.tableContainer}>
          <Table
            className={classes.table}
            aria-labelledby="tableTitle"
            size={'medium'}
            stickyHeader
            style={{borderCollapse: 'collapse'}}
            classes={{
              root: classes.table,
            }}
          >
            <EnhancedTableHead
              classes={classes}
              enableSelection={enableSelection}
              includeShareColumn={includeShareColumn}
              numSelected={selectedIds.length}
              onRequestSort={handleRequestSort}
              onSelectAllClick={handleSelectAllClick}
              order={order}
              orderBy={orderBy}
              rowCount={filteredRows.length}
            />
            <TableBody>
              {isLoading && tableRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} align="center">
                    Loading results...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && tableRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} align="center">
                    <div className={classes.loadMoreContainer}>
                      <div className={classes.loadMoreInner}>
                        <Typography variant="body2" color="textSecondary">
                          No results available.
                        </Typography>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {tableRows.map((row, index) => {
                const isItemSelected = enableSelection ? isSelected(row.id) : false;
                const labelId = `enhanced-table-checkbox-${index}`;
                const dateString = new Date(row.dateRun).toLocaleString();

                return (
                  <TableRow
                    hover
                    onClick={event => handleRowClick(event, row)}
                    role="checkbox"
                    aria-checked={enableSelection ? isItemSelected : undefined}
                    tabIndex={-1}
                    key={row.uid}
                    selected={enableSelection && isItemSelected}
                    classes={{selected: classes.selected}}
                    className={classes.tableRow}
                  >
                    {enableSelection && (
                      <TableCell padding="checkbox" style={{width: '52px'}}>
                        <Checkbox
                          checked={isItemSelected}
                          inputProps={{'aria-labelledby': labelId}}
                          color="primary"
                          onClick={event => handleCheckboxClick(event, row.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell
                      component="th"
                      id={labelId}
                      scope="row"
                      padding="normal"
                      style={{
                        width: getColumnWidth('buildingTypeName'),
                        maxWidth: getColumnWidth('buildingTypeName'),
                      }}
                    >
                      <Typography
                        variant="body1"
                        noWrap
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                        title={row.buildingTypeName}
                      >
                        {row.buildingTypeName}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('dateRun')}}
                    >
                      <Typography
                        variant="body1"
                        noWrap
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                        title={dateString}
                      >
                        {dateString}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('totalEnergy')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.totalEnergy)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('thermalDiscomfort')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.thermalDiscomfort)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('aqDiscomfort')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.aqDiscomfort)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('cost')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.cost, 2)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('peakElectricity')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.peakElectricity)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('peakGas')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.peakGas)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('peakDistrictHeating')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.peakDistrictHeating)}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{width: getColumnWidth('compTimeRatio')}}
                    >
                      <Typography variant="body1">
                        {formatMetric(row.compTimeRatio)}
                      </Typography>
                    </TableCell>
                    {includeShareColumn && (
                      <TableCell
                        align="center"
                        style={{width: getColumnWidth('isShared')}}
                      >
                        <div className={classes.shareStatusWrapper}>
                          <Tooltip
                            title={
                              row.isShared
                                ? 'Shared publicly'
                                : 'Private to your account'
                            }
                          >
                            {row.isShared ? (
                              <PublicIcon color="primary" fontSize="small" />
                            ) : (
                              <LockIcon color="disabled" fontSize="small" />
                            )}
                          </Tooltip>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {hasMoreResults && (
                <TableRow hover={false} className={classes.loadMoreRow}>
                  <TableCell
                    style={{padding: 0, borderBottom: 'none'}}
                    colSpan={columnCount}
                    align="center"
                  >
                    <div className={classes.loadMoreContainer}>
                      <div className={classes.loadMoreInner}>
                        <div className={classes.loadMoreGradientLeft} />
                        <Button
                          variant="outlined"
                          color="primary"
                          onClick={onLoadMoreResults}
                          disabled={isLoadingMoreResults}
                        >
                          {isLoadingMoreResults ? 'Loading...' : 'Load more results'}
                        </Button>
                        <div className={classes.loadMoreGradientRight} />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
        ) : (
          <div className={classes.scatterWrapper}>
            <ResultsScatterPlot
              rows={filteredRows}
              xAxis={xAxisOption}
              yAxis={yAxisOption}
              onPointClick={setSelectedResult}
              isLoading={isLoading}
            />
          </div>
        )}
        <div className={classes.footer}>
          <Typography variant="body2" className={classes.footerText}>
            These results are made with BOPTEST. Please visit the{' '}
            <a
              href="https://ibpsa.github.io/project1-boptest/"
              target="_blank"
              rel="noopener noreferrer"
              className={classes.link}
            >
              BOPTEST Homepage
            </a>{' '}
            to learn more.
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            className={classes.footerToggle}
            aria-label="results view"
          >
            <ToggleButton value="table" aria-label="table view">
              Table
            </ToggleButton>
            <ToggleButton value="scatter" aria-label="scatter view">
              Scatter
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
      </Paper>
    </div>
  );
}
